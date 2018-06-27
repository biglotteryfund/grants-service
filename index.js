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

function getPaginationParams(queryParams) {
  const perPageCount = (queryParams.limit && parseInt(queryParams.limit)) || 10;
  const pageParam = queryParams.page && parseInt(queryParams.page);
  const currentPage = pageParam > 1 ? pageParam : 1;
  const skipCount = perPageCount * (currentPage - 1);
  return { currentPage, perPageCount, skipCount };
}

function fetchGrants(collection, queryParams) {
  const match = {};
  if (queryParams.q) {
    match.$text = { $search: queryParams.q };
    // addFields.score = { $meta: 'textScore' };
  }

  const pagination = getPaginationParams(queryParams);

  return collection
    .aggregate([{ $match: match }])
    .skip(pagination.skipCount)
    .limit(pagination.perPageCount)
    .toArray();
}

// Better to do this at data model / mongo end? Trade-offs of importing raw data.
function cleanResults(data) {
  return {
    amountAwarded: data["Amount Awarded"],
    awardDate: data["Award Date"],
    description: data["Description"],
    grantProgrammeCode: data["Grant Programme:Code"],
    grantProgrammeTitle: data["Grant Programme:Title"],
    identifier: data["Identifier"],
    organisationType: data["BIGField_Organisation_Type"],
    recipientCharityNumber: data["Recipient Org:Charity Number"],
    recipientCompanyNumber: data["Recipient Org:Company Number"],
    recipientIdentifier: data["Recipient Org:Identifier"],
    recipientLocation0GeoCode: data["Recipient Org:Location:0:Geographic Code"],
    recipientLocation0Name: data["Recipient Org:Location:0:Name"],
    recipientLocation1GeoCode: data["Recipient Org:Location:1:Geographic Code"],
    recipientLocation1Name: data["Recipient Org:Location:1:Name"],
    recipientName: data["Recipient Org:Name"],
    title: data["Title"]
  };
}

module.exports = async (req, res) => {
  try {
    const collection = await connectToMongo();

    const queryParams = qs.parse(url.parse(req.url).search, {
      ignoreQueryPrefix: true
    });

    const results = await fetchGrants(collection, queryParams);

    send(res, 200, results.map(cleanResults));
  } catch (error) {
    send(res, 500, "Failed to connect to data store");
  }
};
