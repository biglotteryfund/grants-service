'use strict';
const express = require('express');
const router = express.Router();

const { connectToMongo } = require('../lib/mongo');
const { fetchGrants, fetchGrantById } = require('./search');
const cachedFacets = require('../data/facets');
const { normaliseError } = require('./errors');

router.route('/').get(async (req, res) => {
    try {
        const { client, collection } = await connectToMongo();
        const results = await fetchGrants(collection, req.query);
        client.close();
        res.json(results);
    } catch (error) {
        const normalisedError = normaliseError(error);
        res.status(normalisedError.status).json({
            result: null,
            error: normalisedError
        });
    }
});

router.route('/:id').get(async (req, res) => {
    try {
        const { client, collection } = await connectToMongo();
        const result = await fetchGrantById(collection, req.params.id);
        client.close();
        res.json({ result });
    } catch (error) {
        const normalisedError = normaliseError(error);
        res.status(normalisedError.status).json({
            result: null,
            error: normalisedError
        });
    }
});

router.route('/facets').get((req, res) => {
    res.json(cachedFacets);
});

module.exports = router;
