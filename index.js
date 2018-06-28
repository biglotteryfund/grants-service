"use strict";
require("dotenv").config();
const { send } = require("micro");
const url = require("url");
const qs = require("qs");
const { concat } = require("lodash");
const MongoClient = require("mongodb").MongoClient;

async function connectToMongo() {
  const client = await MongoClient.connect(process.env.MONGO_URL);
  return client
    .db(process.env.MONGO_DB)
    .collection(process.env.MONGO_COLLECTION);
}

function buildMatchCriteria(queryParams) {
  const match = {};
  if (queryParams.q) {
    match.$text = { $search: queryParams.q };
  }

  return match;
}

function buildFacetsCriteria(queryParams) {
  return {
    grantProgramme: [
      {
        $group: {
          _id: "$Grant Programme:Title",
          count: { $sum: 1 }
        }
      }
    ]
  };
}

function buildPagination(queryParams, totalResults) {
  const perPageCount =
    (queryParams.limit && parseInt(queryParams.limit)) || 100;
  const pageParam = queryParams.page && parseInt(queryParams.page);
  const currentPage = pageParam > 1 ? pageParam : 1;
  const skipCount = perPageCount * (currentPage - 1);
  const totalPages = Math.ceil(totalResults / perPageCount);

  return { currentPage, perPageCount, skipCount, totalPages };
}

async function fetchGrants(collection, queryParams) {
  const matchCriteria = buildMatchCriteria(queryParams);
  const facetsCriteria = buildFacetsCriteria(queryParams);

  const totalResults = await collection.find(matchCriteria).count();

  const pagination = buildPagination(queryParams, totalResults);

  const facets = await collection
    .aggregate([{ $match: matchCriteria }, { $facet: facetsCriteria }])
    .toArray();

  const results = await collection
    .aggregate([{ $match: matchCriteria }, { $project: { _id: 0 } }])
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

module.exports = async (req, res) => {
  try {
    const collection = await connectToMongo();

    const queryParams = qs.parse(url.parse(req.url).search, {
      ignoreQueryPrefix: true
    });

    const results = await fetchGrants(collection, queryParams);
    send(res, 200, results);
  } catch (error) {
    console.log(error);
    send(res, 500, "Failed to connect to data store");
  }
};
