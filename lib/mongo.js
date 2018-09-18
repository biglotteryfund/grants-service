'use strict';
const { MongoClient } = require('mongodb');

const INDICES = {
    spec: {
        'title': 'text',
        'description': 'text',
        'recipientOrganization.name': 'text'
    },
    options: {
        weights: {
            'title': 10,
            'recipientOrganization.name': 5,
            'description': 1
        },
        name: 'TextIndex'
    }
};

async function connectToMongo() {
    const client = await MongoClient.connect(process.env.MONGO_URL);
    const collection = await client
        .db(process.env.MONGO_DB)
        .collection(process.env.MONGO_COLLECTION);

    // create indices
    collection.createIndex(INDICES.spec, INDICES.options);

    return { client, collection };
}

module.exports = {
    connectToMongo,
    INDICES
};
