'use strict';

const serverless = require('serverless-http');
const express = require('express');
const app = express();
require('dotenv').config();
const request = require('request-promise-native');
const MongoClient = require('mongodb').MongoClient;

async function connectToMongo() {
    const client = await MongoClient.connect(process.env.MONGO_URL);
    return client
        .db(process.env.MONGO_DB)
        .collection(process.env.MONGO_COLLECTION);
}

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
            'Grant Programme:Title': {
                $eq: queryParams.programme
            }
        });
    }

    if (queryParams.orgType) {
        match.$and.push({
            'BIGField_Organisation_Type': {
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
                        'Recipient Org:Location:0:Geographic Code': {
                            $eq: postcodeData.result.codes.admin_district
                        }
                    },
                    {
                        'Recipient Org:Location:1:Geographic Code': {
                            $eq: postcodeData.result.codes.admin_district
                        }
                    }
                ]);
            }
        } catch (error) {
            // @TODO
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

function buildFacetsCriteria(queryParams) {
    return {
        grantProgramme: [
            {
                $group: {
                    _id: '$Grant Programme:Title',
                    count: {$sum: 1}
                }
            }
        ],
        orgType: [
            {
                $group: {
                    _id: '$BIGField_Organisation_Type',
                    count: {$sum: 1}
                }
            }
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

    return {currentPage, perPageCount, skipCount, totalPages};
}

async function fetchGrants(collection, queryParams) {
    const matchCriteria = await buildMatchCriteria(queryParams);
    const facetsCriteria = buildFacetsCriteria(queryParams);

    const totalResults = await collection.find(matchCriteria).count();

    const pagination = buildPagination(queryParams, totalResults);

    const facets = await collection
        .aggregate([{$match: matchCriteria}, {$facet: facetsCriteria}])
        .toArray();

    let aggregationPipeline = [
        {
            $match: matchCriteria
        },
        {
            $project: {
                _id: 0
            },
        }
    ];

    if (queryParams.q) {
        aggregationPipeline.push({
            $sort: {
                score: {
                    $meta: "textScore"
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

app.get('/', async (req, res) => {
    try {
        const collection = await connectToMongo();
        const results = await fetchGrants(collection, req.query);
        res.send(results);
    } catch (error) {
        console.log(error);
        res.send(error);
    }
});

module.exports.handler = serverless(app);
