/* eslint-env jest */
'use strict';
const { MongoClient } = require('mongodb');
const mockGrantData = require('../test/fixtures/grants');
const { INDICES } = require('../lib/mongo');

const { fetchGrants } = require('./search');

describe('Past Grants Search', () => {
    let connection;
    let db;
    let grantsCollection;

    beforeAll(async () => {
        connection = await MongoClient.connect(global.__MONGO_URI__);
        db = await connection.db(global.__MONGO_DB_NAME__);

        // create mock data
        grantsCollection = db.collection('grants');
        await grantsCollection.insertMany(mockGrantData.results);

        // add the indices
        grantsCollection.createIndex(INDICES.spec, INDICES.options);
    });

    afterAll(async () => {
        await connection.close();
        await db.close();
    });

    // Convenience method for querying directly without passing a collection
    const queryGrants = async query => fetchGrants(grantsCollection, query);

    it('should find grants by text search', async () => {
        const grants = await queryGrants({
            q: 'youth'
        });
        expect(grants.results.length).toBe(5);
    });

    it('should find grants by programme', async () => {
        const grants = await queryGrants({
            programme: 'Awards for All'
        });
        expect(grants.results.length).toBe(50);
    });

    it('should find grants by organisation type', async () => {
        const grants = await queryGrants({
            orgType: 'Charity'
        });
        expect(grants.results.length).toBe(41);
    });

    it('should find grants by postcode', async () => {
        const grants = await queryGrants({
            postcode: 'BN13 1NQ'
        });
        expect(grants.results[0].title).toEqual(
            'Meetings and outings'
        );
    });

    it('should combine filters', async () => {
        const grants = await queryGrants({
            orgType: 'Charity',
            q: 'children tennis',
            programme: 'Awards for All',
            postcode: 'BN8 4JL'
        });
        expect(grants.results[0].title).toEqual('New Equipment');
    });

    it('should return empty results for invalid queries', async () => {
        const grants = await queryGrants({
            orgType: 'MadeUpOrg',
            q: 'purple monkey dishwasher',
            programme: 'Big Cheese Fund',
            postcode: 'N1 9GU'
        });
        expect(grants.results.length).toBe(0);
    });
});
