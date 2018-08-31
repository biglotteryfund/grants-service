'use strict';
const express = require('express');
const router = express.Router();

const { connectToMongo } = require('../mongo');
const { fetchGrants } = require('./search');

router.route('/').get(async (req, res) => {
    try {
        const collection = await connectToMongo();
        const results = await fetchGrants(collection, req.query);
        res.send(results);
    } catch (error) {
        console.log(error);
        res.send(error);
    }
});

module.exports = router;
