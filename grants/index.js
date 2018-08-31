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
        console.log(error);
        res.send(error);
    }
});

module.exports = router;
