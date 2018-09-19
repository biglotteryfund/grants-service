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

async function buildAggregationPipeline(queryParams, perPage, skipCount) {
    const matchCriteria = await buildMatchCriteria(queryParams);

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
        aggregationPipeline = concat(aggregationPipeline, [
            {
                $sort: {
                    score: {
                        $meta: 'textScore'
                    }
                }
            },
            {
                $addFields: {
                    _textScore: { $meta: 'textScore' }
                }
            },
            {
                $match: { _textScore: { $gt: 1.0 } }
            }
        ]);
    }

    aggregationPipeline = concat(aggregationPipeline, [
        {
            $facet: {
                totalResults: [
                    {
                        $count: 'count'
                    }
                ],
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
                ],
                paginatedResults: [{ $skip: skipCount }, { $limit: perPage }]
            }
        }
    ]);

    return aggregationPipeline;
}

async function fetchGrants(collection, queryParams) {
    const perPageCount = (queryParams.limit && parseInt(queryParams.limit)) || 50;
    const pageParam = queryParams.page && parseInt(queryParams.page);
    const currentPage = pageParam > 1 ? pageParam : 1;
    const skipCount = perPageCount * (currentPage - 1);

    const pipeline = await buildAggregationPipeline(
        queryParams,
        perPageCount,
        skipCount
    );
    const result = await collection.aggregate(pipeline).toArray();

    const { totalResults, paginatedResults, ...facets } = head(result);

    const totalResultsValue = head(totalResults).count;

    return {
        meta: {
            totalResults: totalResultsValue,
            pagination: {
                currentPage: currentPage,
                perPageCount: perPageCount,
                skipCount: skipCount,
                totalPages: Math.ceil(totalResultsValue / perPageCount)
            }
        },
        facets: facets,
        results: paginatedResults
    };
}

module.exports = {
    fetchGrants
};
