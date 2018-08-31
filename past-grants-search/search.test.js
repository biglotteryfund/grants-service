/* eslint-env jest */
'use strict';
const {MongoClient} = require('mongodb');
const mockGrantData = require('../test/fixtures/grants');

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

        // add the index
        grantsCollection.createIndex(
            {
                Title: "text",
                Description: "text", "Recipient Org:Name": "text"
            },
            {
                weights: {
                    Title: 10,
                    "Recipient Org:Name": 5,
                    Description: 1
                },
                name: "TextIndex"
            }
        );
    });

    afterAll(async () => {
        await connection.close();
        await db.close();
    });

    // Convenience method for querying directly without passing a collection
    const queryGrants = async (query) => fetchGrants(grantsCollection, query);

    it('should find grants by text search', async () => {
        const grants = await queryGrants({
            q: 'youth'
        });
        expect(grants.results.length).toBe(5);
    });

    it('should find grants by programme', async () => {
        const grants = await queryGrants({
            programme: 'National Lottery Awards for All'
        });
        expect(grants.results.length).toBe(9);
    });

    it('should find grants by organisation type', async () => {
        const grants = await queryGrants({
            orgType: 'Charity'
        });
        expect(grants.results.length).toBe(35);
    });

    it('should find grants by postcode', async () => {
        const grants = await queryGrants({
            postcode: 'E14 0FL'
        });
        expect(grants.results[0].Title).toEqual('Asian Women Lone Parents Association');
    });

    it('should combine filters', async () => {
        const grants = await queryGrants({
            orgType: 'Charity',
            q: 'social disadvantage',
            programme: 'Awards for All',
            postcode: 'SW16 2AL'
        });
        expect(grants.results[0].Title).toEqual('Calm Confident Kids');
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
