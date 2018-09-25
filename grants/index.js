'use strict';
const express = require('express');
const router = express.Router();

const { connectToMongo } = require('../lib/mongo');
const { fetchGrants } = require('./search');

router.route('/').get(async (req, res) => {
    try {
        const { client, collection } = await connectToMongo();
        const results = await fetchGrants(collection, req.query);
        client.close();
        res.send(results);
    } catch (error) {
        res.send(error);
    }
});

router.route('/:id').get(async (req, res) => {
    try {
        const { client, collection } = await connectToMongo();
        const result = await collection.findOne({ id: req.params.id });
        client.close();
        res.send(result);
    } catch (error) {
        res.send(error);
    }
});

module.exports = router;
