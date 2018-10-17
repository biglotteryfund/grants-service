'use strict';
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function connectToMongo() {
    try {
        const client = await MongoClient.connect(process.env.MONGO_URL);
        const db = await client.db(process.env.MONGO_DB);
        const grantsCollection = await db.collection(
            process.env.MONGO_COLLECTION
        );
        const facetsCollection = await db.collection(
            process.env.MONGO_COLLECTION_FACETS
        );
        return { client, grantsCollection, facetsCollection };
    } catch (e) {
        throw new Error('MongoConnect');
    }
}

module.exports = {
    connectToMongo
};
