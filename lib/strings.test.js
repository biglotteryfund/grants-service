/* eslint-env jest */
'use strict';

const { head } = require('lodash');
const { numberWithCommas, matchPostcode } = require('./strings');

describe('numberWithCommas', () => {
    it('should format a number with comma separators', () => {
        expect(numberWithCommas(123)).toBe('123');
        expect(numberWithCommas(1548028)).toBe('1,548,028');
    });
});

describe('matchPostcode', () => {
    it('should match a valid postcode', () => {
        const valid = [
            'TW8',
            'B13',
            'TW8 9GS',
            'BS98 1TL',
            'DE99 3GG',
            'DE55 4SW',
            'DH98 1BT',
            'DH99 1NS',
            'W1N 4DJ',
            'AA9A 9AA',
            'AA99 9AA',
            'BS98 1TL',
            'DE993GG'
        ];

        valid.forEach(postcode => {
            expect(head(matchPostcode(postcode))).toBe(postcode);
        });
    });
});
