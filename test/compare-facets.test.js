#!/usr/bin/env node
/* eslint-env jest */
'use strict';

const facetsOld = require('../facets-old');
const facetsNew = require('../facets-new');

describe('Grants import process', () => {

    it('should not introduce new countries (or remove existing ones)', () => {
        expect(facetsNew.resultsEn.countries.length).toEqual(facetsOld.resultsEn.countries.length);
    });

    it('should not retroactively add past grants', () => {
        expect(facetsNew.resultsEn.awardDate.find(_ => _._id === 2018).count).toEqual(facetsOld.resultsEn.awardDate.find(_ => _._id === 2018).count);
    });

    it('should not modify the number of Westminster Constituencies', () => {
        expect(facetsNew.resultsEn.westminsterConstituencies.length).toEqual(facetsOld.resultsEn.westminsterConstituencies.length);
        expect(facetsNew.resultsEn.westminsterConstituencies.length).toBeLessThanOrEqual(650); // current number of constituencies
    });

    it('should not modify the number of Local Authorities', () => {
        expect(facetsNew.resultsEn.localAuthorities.length).toEqual(facetsOld.resultsEn.localAuthorities.length);
        expect(facetsNew.resultsEn.localAuthorities.length).toBeLessThanOrEqual(418); // current number of local authorities
    });

});
