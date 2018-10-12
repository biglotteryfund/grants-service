'use strict';
const express = require('express');
const router = express.Router();
const keywordExtractor = require("keyword-extractor");

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

router.route('/:id').get(async (req, res) => {
    try {
        const mongo = await connectToMongo();
        const result = await fetchGrantById(mongo.grantsCollection, req.params.id);

        const keywords = keywordExtractor.extract(result.description, {
            language: "english",
            remove_digits: true,
            return_changed_case: true,
            remove_duplicates: true,
        });

        const localAuthority = result.beneficiaryLocation.find(l => l.geoCodeType === 'CMLAD');

        const query = {
            q: keywords.slice(0, 3).join(' '),
            limit: '3',
            programme: result.grantProgramme[0].title,
            fuzzy: true,
            exclude: req.params.id
        };

        if (localAuthority) {
            query.localAuthority = localAuthority.geoCode;
        }

        console.log(query);

        const related = await fetchGrants(mongo, query);

        mongo.client.close();
        res.json({ keywords, related, result });
    } catch (error) {
        const normalisedError = normaliseError(error);
        console.log(error);
        res.status(normalisedError.status).json({
            result: null,
            error: normalisedError
        });
    }
});

router.get('/build-facets', async (req, res) => {
    try {
        const mongo = await connectToMongo();
        const results = await fetchFacets(mongo.grantsCollection, { awardDate: { $exists: true } });
        await mongo.facetsCollection.insertOne(results);
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

module.exports = router;
