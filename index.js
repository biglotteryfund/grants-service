'use strict';
const serverless = require('serverless-http');
const express = require('express');
const app = express();
require('dotenv').config();

// Mount routes
// The path here must match the basePath in serverless.yml for the domain
app.use('/past-grants-search', require('./past-grants-search/index'));

module.exports.handler = serverless(app);
