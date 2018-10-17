'use strict';
const express = require('express');
const router = express.Router();

const { connectToMongo } = require('../lib/mongo');
const { fetchGrants, fetchGrantById, fetchFacets } = require('./search');
const { normaliseError } = require('./errors');

router.route('/').get(async (req, res) => {
    try {
        const mongo = await connectToMongo();
        const results = await fetchGrants(mongo, req.query);
        mongo.client.close();
        res.json(results);
    } catch (error) {
        const normalisedError = normaliseError(error);
        res.status(normalisedError.status).json({
            result: null,
            error: normalisedError
        });
    }
});

router.get('/build-facets', async (req, res) => {
    try {
        const mongo = await connectToMongo();
        const results = await fetchFacets(mongo.grantsCollection, {
            awardDate: { $exists: true }
        });
        await mongo.facetsCollection.insertOne(results);
        mongo.client.close();
        res.json(results);
    } catch (error) {
        console.log(error);
        const normalisedError = normaliseError(error);
        res.status(normalisedError.status).json({
            result: null,
            error: normalisedError
        });
    }
});

router.route('/:id').get(async (req, res) => {
    try {
        const mongo = await connectToMongo();
        const result = await fetchGrantById(
            mongo.grantsCollection,
            req.params.id
        );
        mongo.client.close();
        res.json({ result });
    } catch (error) {
        console.log(error);
        const normalisedError = normaliseError(error);
        res.status(normalisedError.status).json({
            result: null,
            error: normalisedError
        });
    }
});

module.exports = router;
