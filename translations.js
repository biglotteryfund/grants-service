'use strict';
const { get } = require('lodash');

const translations = {
    misc: {
        'Under': {
          en: 'Under',
          cy: 'O dan',
        }
    },
    sortOptions: {
        'Most recent': {
            en: 'Most recent',
            cy: 'WELSH TEXT',
        }
    },
    countries: {
        'England': {
            en: 'England',
            cy: 'Lloegr',
        },
        'Scotland': {
            en: 'Scotland',
            cy: 'Yr Alban',
        },
        'Northern Ireland': {
            en: 'Northern Ireland',
            cy: 'Gogledd Iwerddon',
        },
        'Wales': {
            en: 'Wales',
            cy: 'Cymru',
        },
    },
    localAuthorities: {

    },
    westminsterConstituencies: {

    },
    orgTypes: {
        'Charity: All': {
            en: 'Charity: All',
            cy: 'WELSH ALL CHARITIES',
        }
    }
};

const getTranslation = (langKey, str, locale) => get(translations, [langKey, str, locale], str);

/**
 * Utility function to add in a translation to the label
 */
const translateLabels = (langKey, locale) => {
    return facet => {
        const translation = getTranslation(langKey, facet.label, locale);
        // Is there a translation for this?
        if (translation !== facet.label) {
            facet.label = translation;
        }
        return facet;
    };
};

module.exports = {
    translations,
    getTranslation,
    translateLabels
};
