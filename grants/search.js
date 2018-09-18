'use strict';
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

    if (queryParams.postcode) {
        try {
            const postcodeData = await lookupPostcode(queryParams.postcode);
            if (postcodeData && postcodeData.result) {
                match.$or = match.$or.concat([
                    {
                        'beneficiaryLocation.geoCode': {
                            $eq: postcodeData.result.codes.admin_district
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

function buildFacetsCriteria() {
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
                        $year: { $dateFromString: { dateString: '$awardDate' } }
                    },
                    count: { $sum: 1 }
                }
            }
        ],
        grantProgramme: [
            {
                $group: {
                    _id: { $arrayElemAt: ['$grantProgramme.title', 0] },
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

function buildPagination(queryParams, totalResults) {
    const perPageCount =
        (queryParams.limit && parseInt(queryParams.limit)) || 50;
    const pageParam = queryParams.page && parseInt(queryParams.page);
    const currentPage = pageParam > 1 ? pageParam : 1;
    const skipCount = perPageCount * (currentPage - 1);
    const totalPages = Math.ceil(totalResults / perPageCount);

    return { currentPage, perPageCount, skipCount, totalPages };
}

async function fetchGrants(collection, queryParams) {
    const matchCriteria = await buildMatchCriteria(queryParams);
    const facetsCriteria = buildFacetsCriteria();

    const totalResults = await collection.find(matchCriteria).count();

    const pagination = buildPagination(queryParams, totalResults);

    const facets = await collection
        .aggregate([{ $match: matchCriteria }, { $facet: facetsCriteria }])
        .toArray();

    let aggregationPipeline = [
        {
            $match: matchCriteria
        },
        {
            $project: {
                _id: 0
            }
        }
    ];

    if (queryParams.q) {
        aggregationPipeline.push({
            $sort: {
                score: {
                    $meta: 'textScore'
                }
            }
        });
    }

    const results = await collection
        .aggregate(aggregationPipeline)
        .skip(pagination.skipCount)
        .limit(pagination.perPageCount)
        .toArray();

    return {
        results,
        facets,
        meta: {
            totalResults,
            pagination
        }
    };
}

module.exports = {
    fetchGrants
};
