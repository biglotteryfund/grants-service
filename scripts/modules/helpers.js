'use strict';

const wardLocations = require('../../data/ward-locations');
const fundingProgrammes = require('../../data/fundingProgrammes');
const { GEOCODE_TYPES } = require('../../lib/geocodes');

const knownProgrammes = Object.keys(fundingProgrammes);

// Create a dictionary of geocodes so we can look them up and query their types directly
let locationsByCode = [];
wardLocations.forEach(l => {
    locationsByCode.push({
        code: l.wardCode,
        type: GEOCODE_TYPES.ward
    }, {
        code: l.constituencyCode,
        type: GEOCODE_TYPES.constituency
    }, {
        code: l.localAuthorityCode,
        type: GEOCODE_TYPES.localAuthority
    });
});

// Supported countries and their regex patterns
const COUNTRIES = {
    england: {
        pattern: /^E/,
        title: 'England'
    },
    wales: {
        pattern: /^W/,
        title: 'Wales'
    },
    scotland: {
        pattern: /^S/,
        title: 'Scotland'
    },
    'northern-ireland': {
        pattern: /^N/,
        title: 'Northern Ireland'
    }
};

// Find a country name based on a geocode
function getCountryName(geocode) {
    let countryName, isValid;
    for (let countryKey in COUNTRIES) {
        const country = COUNTRIES[countryKey];
        isValid = country.pattern.test(geocode);
        if (isValid) {
            countryName = country.title;
            break;
        }
    }
    return countryName;
}


module.exports = {
    knownProgrammes,
    wardLocations,
    locationsByCode,
    GEOCODE_TYPES,
    getCountryName
};
