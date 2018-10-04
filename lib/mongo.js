'use strict';
const { MongoClient } = require('mongodb');

async function connectToMongo() {
    try {
        const client = await MongoClient.connect(process.env.MONGO_URL);
        const collection = await client
            .db(process.env.MONGO_DB)
            .collection(process.env.MONGO_COLLECTION);

        return { client, collection };
    } catch (e) {
        throw new Error('MongoConnect');
    }
}

module.exports = {
    connectToMongo
};
