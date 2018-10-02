'use strict';
const request = require('request-promise-native');
const { head } = require('lodash');

const ID_PREFIX = '360G-blf-';

const isPostcode = input => {
    // Via https://github.com/chriso/validator.js/blob/master/lib/isPostalCode.js#L54
    const POSTCODE_PATTERN = /(gir\s?0aa|[a-zA-Z]{1,2}\d[\da-zA-Z]?\s?(\d[a-zA-Z]{2})?)/;
    return !!input.match(POSTCODE_PATTERN);
};

async function lookupPostcode(postcode) {
    return request({
        method: 'GET',
        url: `https://api.postcodes.io/postcodes/${postcode}`,
        headers: {
            'Content-Type': 'application/json'
        }
    }).then(response => JSON.parse(response));
}

async function buildMatchCriteria(queryParams) {
    const match = {};

    match.$and = [];
    match.$or = [];

    // Handle a directly-entered postcode
    if (queryParams.q && isPostcode(queryParams.q)) {
        queryParams.postcode = queryParams.q;
        delete queryParams.q;
    }

    if (queryParams.q && !isPostcode(queryParams.q)) {
        if (queryParams.q.indexOf('"') === -1) {
            queryParams.q = queryParams.q.split(' ').map(t => {
                // Is this a negation? Don't wrap it in quotes
                if (t[0] === '-') {
                    return t;
                }
                return `"${t}"`;
            }).join(' ');
        }

        match.$text = {
            $search: queryParams.q
        };
    }

    if (queryParams.programme) {
        match.$and.push({
            'grantProgramme.title': {
                $eq: queryParams.programme
            }
        });
    }

    if (queryParams.orgType) {
        match.$and.push({
            'recipientOrganization.organisationType': {
                $regex: `^${queryParams.orgType}`,
                $options: 'i'
            }
        });
    }

    if (queryParams.year) {
        var start = new Date(queryParams.year, 0, 1);
        var end = new Date(queryParams.year, 11, 31);

        match.$and.push({
            awardDate: { $gte: start, $lt: end }
        });
    }

    if (queryParams.amount) {
        const [minAmount, maxAmount] = queryParams.amount
            .split('|')
            .map(num => parseInt(num, 10));
        match.$and.push({
            amountAwarded: { $gte: minAmount || 0, $lte: maxAmount || Infinity }
        });
    }

    if (queryParams.postcode) {
        try {
            const postcodeData = await lookupPostcode(queryParams.postcode);
            if (postcodeData && postcodeData.result) {
                match.$or = match.$or.concat([
                    {
                        'beneficiaryLocation.geoCode': {
                            $in: [
                                postcodeData.result.codes.admin_district,
                                postcodeData.result.codes.admin_ward,
                                postcodeData.result.codes
                                    .parliamentary_constituency
                            ]
                        }
                    }
                ]);
            }
        } catch (error) {
            // @TODO handle postcode lookup failure
        }
    }

    if (queryParams.country) {
        let regex;
        switch (queryParams.country) {
            case 'england':
                regex = /^E/;
                break;
            case 'wales':
                regex = /^W/;
                break;
            case 'scotland':
                regex = /^S/;
                break;
            case 'northern-ireland':
                regex = /^N/;
                break;
        }
        if (regex) {
            match.$and.push({
                'beneficiaryLocation.geoCode': { $regex: regex }
            }, {
                'beneficiaryLocation.geoCodeType': 'CMLAD'
            });
        }
    }

    // $and and $or cannot be empty arrays

    if (match.$and.length === 0) {
        delete match.$and;
    }

    if (match.$or.length === 0) {
        delete match.$or;
    }

    return match;
}

function buildLocationFacet(codeType) {
    return [
        {
            $project: {
                items:  {
                    $filter: {
                        input: '$beneficiaryLocation',
                        as: 'location',
                        cond: { $eq: ['$$location.geoCodeType', codeType]}
                    }
                }
            }
        },
        {
            $group: {
                _id: {
                    $arrayElemAt: [ '$items.name', 0]
                },
                code: { $first: { $arrayElemAt: [ '$items.geoCode', 0] } },
                count: { $sum: 1 },
            }
        },
        { $sort: { _id: 1 } },
    ]
}

function buildFacetCriteria() {
    return {

        localAuthorities: buildLocationFacet('CMLAD'),

        westminsterConstituencies: buildLocationFacet('WPC'),

        amountAwarded: [
            {
                $bucket: {
                    groupBy: '$amountAwarded',
                    boundaries: [0, 10000, 100000, 1000000, Infinity],
                    output: {
                        count: { $sum: 1 }
                    }
                }
            }
        ],

        awardDate: [
            {
                $group: {
                    _id: {
                        $year: '$awardDate'
                    },
                    count: { $sum: 1 }
                }
            }
        ],

        grantProgramme: [
            {
                $group: {
                    _id: {
                        $arrayElemAt: ['$grantProgramme.title', 0]
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ],

        orgType: [
            {
                $group: {
                    _id: {
                        $arrayElemAt: [
                            '$recipientOrganization.organisationType',
                            0
                        ]
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]
    };
}

function determineSortCriteria(queryParams) {
    let sortConf = { awardDate: -1 };
    if (queryParams.q) {
        sortConf = {
            score: {
                $meta: 'textScore'
            }
        };
    } else if (queryParams.sort) {
        const [field, direction] = queryParams.sort.split('|');
        if (['awardDate', 'amountAwarded'].indexOf(field) !== -1) {
            const newSortConf = {};
            newSortConf[field] = direction === 'asc' ? 1 : -1;
            sortConf = newSortConf;
        }
    }

    return sortConf;
}

async function fetchGrants(collection, queryParams) {
    const perPageCount =
        (queryParams.limit && parseInt(queryParams.limit)) || 50;
    const pageParam = queryParams.page && parseInt(queryParams.page);
    const currentPage = pageParam > 1 ? pageParam : 1;
    const skipCount = perPageCount * (currentPage - 1);

    const matchCriteria = await buildMatchCriteria(queryParams);
    const facetCriteria = buildFacetCriteria();

    const sortCritieria = determineSortCriteria(queryParams);

    /**
     * Construct the aggregation pipeline
     */
    const resultsPipeline = [
        { $match: matchCriteria },
        { $sort: sortCritieria },
        {
            $addFields: {
                id: {
                    // Strip 360Giving prefix from returned ID
                    $arrayElemAt: [{ $split: ['$id', ID_PREFIX] }, 1]
                }
            }
        }
    ];

    if (queryParams.q) {
        resultsPipeline.push({
            $addFields: {
                _textScore: { $meta: 'textScore' }
            }
        });
    }

    const grantsResult = await collection
        .aggregate(resultsPipeline, { allowDiskUse: true })
        .skip(skipCount)
        .limit(perPageCount)
        .toArray();

    const facets = await collection
        .aggregate([{ $match: matchCriteria }, { $facet: facetCriteria }])
        .toArray();

    const totalResults = await collection.find(matchCriteria).count();

    const currentSortType = head(Object.keys(sortCritieria));

    return {
        meta: {
            totalResults: totalResults,
            query: queryParams,
            currentSort: {
                type: currentSortType,
                direction: sortCritieria[currentSortType] === 1 ? 'asc' : 'desc'
            },
            pagination: {
                currentPage: currentPage,
                perPageCount: perPageCount,
                skipCount: skipCount,
                totalPages: Math.ceil(totalResults / perPageCount)
            }
        },
        facets: head(facets),
        results: grantsResult
    };
}

module.exports = {
    ID_PREFIX,
    fetchGrants
};
