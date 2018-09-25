'use strict';
const express = require('express');
const router = express.Router();

const { connectToMongo } = require('../lib/mongo');
const { fetchGrants } = require('./search');
const cachedFacets = require('../data/facets');

router.route('/').get(async (req, res) => {
    try {
        const { client, collection } = await connectToMongo();
        const results = await fetchGrants(collection, req.query);
        client.close();
        res.setHeader('cache-control', 'max-age=10,s-maxage=300');
        res.send(results);
    } catch (error) {
        res.send(error);
    }
});

router.route('/facets').get((req, res) => {
    res.send(cachedFacets)
});

module.exports = router;
