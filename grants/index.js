'use strict';
const express = require('express');
const timings = require('server-timings');

const { connectToMongo } = require('../lib/mongo');
const {
    fetchGrants,
    fetchGrantById,
    fetchGrantByRecipient,
    fetchFacets
} = require('./search');
const { normaliseError } = require('./errors');

const router = express.Router();

router.use(timings);

router.route('/').get(async (req, res) => {
    try {
        res.locals.timings.start('fetch-grants');
        const mongo = await connectToMongo();
        const results = await fetchGrants(mongo, req.query);
        mongo.client.close();
        res.locals.timings.end('fetch-grants');
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

router.get('/build-facets', async (req, res) => {
    try {
        const mongo = await connectToMongo();

        const latestGrant = await fetchGrants(mongo, {
            limit: 1,
            sort: 'awardDate|desc'
        });

        const getFacets = async locale =>
            fetchFacets(
                mongo.grantsCollection,
                {
                    awardDate: { $exists: true }
                },
                locale,
                latestGrant
            );

        const resultsEn = await getFacets('en');
        const resultsCy = await getFacets('cy');

        await mongo.facetsCollection.insertOne({
            en: resultsEn,
            cy: resultsCy
        });
        mongo.client.close();
        res.json({ resultsEn, resultsCy });
    } catch (error) {
        console.log(error);
        const normalisedError = normaliseError(error);
        res.status(normalisedError.status).json({
            result: null,
            error: normalisedError
        });
    }
});

router.route('/recipient/:id').get(async (req, res) => {
    try {
        const mongo = await connectToMongo();
        const results = await fetchGrantByRecipient(
            mongo.grantsCollection,
            req.params.id,
            req.query
        );
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
            req.params.id,
            req.query.locale
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
