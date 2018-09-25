'use strict';
const { concat, head } = require('lodash');
const request = require('request-promise-native');

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

    if (queryParams.q) {
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
            .map(parseInt);
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

    // $and and $or cannot be empty arrays

    if (match.$and.length === 0) {
        delete match.$and;
    }

    if (match.$or.length === 0) {
        delete match.$or;
    }

    return match;
}

function buildFacetCriteria() {
    return {
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

async function fetchGrants(collection, queryParams) {
    const perPageCount =
        (queryParams.limit && parseInt(queryParams.limit)) || 50;
    const pageParam = queryParams.page && parseInt(queryParams.page);
    const currentPage = pageParam > 1 ? pageParam : 1;
    const skipCount = perPageCount * (currentPage - 1);

    const matchCriteria = await buildMatchCriteria(queryParams);
    const facetCriteria = buildFacetCriteria();

    /**
     * Construct the aggregation pipeline
     */
    const resultsPipeline = [
        { $match: matchCriteria },
        { $sort: { awardDate: -1 } },
        {
            $addFields: {
                id: {
                    // Strip 360Giving prefix from returned ID
                    $arrayElemAt: [{ $split: ['$id', '360G-blf-'] }, 1]
                }
            }
        }
    ];

    /**
     * If we are performing a text query search
     * 1. Sort results by the mongo textScore
     * 2. Only match results with a minimum text score
     * 3. Add a private _textScore field to results for debugging
     */
    if (queryParams.q) {
        resultsPipeline.push({
            $sort: {
                score: {
                    $meta: 'textScore'
                }
            }
        });

        resultsPipeline.push({
            $addFields: {
                _textScore: { $meta: 'textScore' }
            }
        });
    }

    if (queryParams.sort) {
        const [field, direction] = queryParams.sort.split('|');
        if (['awardDate', 'amountAwarded'].indexOf(field) !== -1) {
            const sortConf = {};
            sortConf[field] = direction === 'asc' ? 1 : -1;
            resultsPipeline.push({
                $sort: sortConf
            });
        }
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

    return {
        meta: {
            totalResults: totalResults,
            pagination: {
                currentPage: currentPage,
                perPageCount: perPageCount,
                skipCount: skipCount,
                totalPages: Math.ceil(totalResults / perPageCount)
            }
        },
        facets: facets,
        results: grantsResult
    };
}

module.exports = {
    fetchGrants
};
