'use strict';
const { MongoClient } = require('mongodb');

const INDICES = {
    spec: {
        title: 'text',
        description: 'text',
        'recipientOrganization.name': 'text',
        'beneficiaryLocation.name': 'text'
    },
    options: {
        weights: {
            title: 5,
            'recipientOrganization.name': 5,
            'beneficiaryLocation.name': 5,
            description: 2
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
