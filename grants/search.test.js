/* eslint-env jest */
'use strict';
const { MongoClient } = require('mongodb');
const mockGrantData = require('../test/fixtures/grants');
const indices = require('../lib/indices');

const { fetchGrants } = require('./search');

describe('Past Grants Search', () => {
    let connection;
    let db;
    let grantsCollection;
    let facetsCollection;

    beforeAll(async () => {
        connection = await MongoClient.connect(global.__MONGO_URI__, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        db = await connection.db(global.__MONGO_DB_NAME__);

        // create mock data
        grantsCollection = db.collection('grants');
        facetsCollection = db.collection('facets');
        await grantsCollection.insertMany(mockGrantData.results, {
            ordered: true,
        });

        await Promise.all(
            indices.map((i) => {
                return grantsCollection.createIndex(i.spec, i.options);
            })
        );
    });

    afterAll(async () => {
        await connection.close();
        await db.close();
    });

    // Convenience method for querying directly without passing a collection
    const queryGrants = async (query) =>
        fetchGrants({ grantsCollection, facetsCollection }, 'en', query);

    it('should return first page of grants', async () => {
        const testLimit = 5;
        const grants = await queryGrants({
            limit: testLimit,
            sort: 'amountAwarded|asc',
        });
        const firstResult = grants.results[0];
        expect(firstResult.title).toBe('Purchase of digital camera & printer');
        expect(grants.results.length).toBe(testLimit);
    });

    it('should return second page of grants', async () => {
        const testLimit = 5;
        const grants = await queryGrants({
            limit: testLimit,
            page: 2,
            sort: 'amountAwarded|asc',
        });
        const firstResult = grants.results[0];
        expect(firstResult.title).toBe(
            'Music education work in special schools'
        );
        expect(grants.results.length).toBe(testLimit);
    });

    it('should find grants by text search', async () => {
        const grants = await queryGrants({
            q: 'youth',
        });
        expect(grants.results.length).toBe(5);
    });

    it('should find grants by programme', async () => {
        const grants = await queryGrants({
            programme: 'Awards for All',
        });
        expect(grants.results.length).toBe(50);
    });

    it('should find grants by organisation type', async () => {
        const grants = await queryGrants({
            orgType: 'Charity',
        });
        expect(grants.results.length).toBe(41);
    });

    xit('should find grants by postcode', async () => {
        const grants = await queryGrants({
            postcode: 'BN13 1NQ',
        });
        expect(grants.results[0].title).toEqual('New Equipment');
    });

    it('should combine filters', async () => {
        const grants = await queryGrants({
            orgType: 'Charity',
            q: 'children tennis',
            programme: 'Awards for All',
            postcode: 'BN8 4JL',
        });
        expect(grants.results[0].title).toEqual('New Equipment');
    });

    it('should return empty results for invalid queries', async () => {
        const result = await queryGrants({
            orgType: 'MadeUpOrg',
            q: 'purple monkey dishwasher',
            programme: 'Big Cheese Fund',
            postcode: 'N1 9GU',
        });

        expect(result.meta.totalResults).toEqual(0);
    });

    it('should convert multi-word queries into quoted strings', async () => {
        const result = await queryGrants({
            q: 'led zeppelin',
        });
        expect(result.meta.query.q).toEqual('"led" "zeppelin"');
    });

    it('should not modify negated words when quoting query strings', async () => {
        const result = await queryGrants({
            q: 'led zeppelin -airships',
        });
        expect(result.meta.query.q).toEqual('"led" "zeppelin" -airships');
    });

    it('should not modify already-quoted words when quoting query strings', async () => {
        const result = await queryGrants({
            q: '"cause you know sometimes words have two meanings"',
        });
        expect(result.meta.query.q).toEqual(
            '"cause you know sometimes words have two meanings"'
        );
    });
});
