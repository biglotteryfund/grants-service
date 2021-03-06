/* eslint-env jest */
'use strict';
const checkSpelling = require('./check-spelling');

describe('checkSpelling', () => {
    test('check spelling', async () => {
        const result = await checkSpelling({
            searchTerm: 'fundig',
            locale: 'en',
        });

        expect(result.hasTypo).toBeTruthy();
        expect(result.suggestions).toEqual(['funding']);
    });

    test('accept multiple words', async () => {
        const result = await checkSpelling({
            searchTerm: 'people and comunity',
            locale: 'en',
        });

        expect(result.hasTypo).toBeTruthy();
        expect(result.suggestions).toEqual(['people and community']);
    });

    test('allow multiple typos', async () => {
        const result = await checkSpelling({
            searchTerm: 'pebple and comunity',
            locale: 'en',
        });

        expect(result.hasTypo).toBeTruthy();
        expect(result.suggestions).toEqual([
            'people and community',
            'pebble and community',
        ]);
    });

    test('no suggestions for correct words', async () => {
        const result = await checkSpelling({
            searchTerm: 'people',
            locale: 'en',
        });

        expect(result.hasTypo).toBeFalsy();
        expect(result.suggestions.length).toBe(0);
    });
});
