'use strict';
const { MongoClient } = require('mongodb');
require('dotenv').config();
async function connectToMongo() {
    const client = await MongoClient.connect(process.env.MONGO_URL);
    const collection = await client
        .db(process.env.MONGO_DB)
        .collection(process.env.MONGO_COLLECTION);

    return { client, collection };
}

module.exports = {
    connectToMongo
};
