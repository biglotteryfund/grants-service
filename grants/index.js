'use strict';
const express = require('express');
const router = express.Router();

const { connectToMongo } = require('../lib/mongo');
const { fetchGrants, fetchGrantById } = require('./search');
const cachedFacets = require('../data/facets');

router.route('/').get(async (req, res) => {
    try {
        const { client, collection } = await connectToMongo();
        const results = await fetchGrants(collection, req.query);
        client.close();
        res.json(results);
    } catch (error) {
        res.send(error);
    }
});

router.route('/:id').get(async (req, res) => {
    try {
        const { client, collection } = await connectToMongo();
        const result = await fetchGrantById(collection, req.params.id);
        client.close();
        res.json({ result });
    } catch (error) {
        console.error(error);
        res.send({
            result: null,
            error: error
        });
    }
});

router.route('/facets').get((req, res) => {
    res.send(cachedFacets);
});

module.exports = router;
