'use strict';
const { get } = require('lodash');

const translations = {
    misc: {
        Under: {
            en: 'Under',
            cy: 'O dan'
        },
        'Last six months': {
            en: 'Last six months',
            cy: 'Chwe mis diwethaf'
        },
        'Last three months': {
            en: 'Last three months',
            cy: 'Tri mis diwethaf'
        }
    },
    sortOptions: {
        'Most recent': {
            en: 'Most recent',
            cy: 'Mwyaf diweddar'
        },
        'Oldest first': {
            en: 'Oldest first',
            cy: 'Hynaf yn gyntaf'
        },
        'Lowest amount first': {
            en: 'Lowest amount first',
            cy: 'Swm isaf yn gyntaf'
        },
        'Highest amount first': {
            en: 'Highest amount first',
            cy: 'Swm uchaf yn gyntaf'
        },
        'Most relevant': {
            en: 'Most relevant',
            cy: 'Mwyaf perthnasol'
        }
    },
    countries: {
        England: {
            en: 'England',
            cy: 'Lloegr'
        },
        Scotland: {
            en: 'Scotland',
            cy: 'Yr Alban'
        },
        'Northern Ireland': {
            en: 'Northern Ireland',
            cy: 'Gogledd Iwerddon'
        },
        Wales: {
            en: 'Wales',
            cy: 'Cymru'
        }
    },
    localAuthorities: {},
    westminsterConstituencies: {},
    orgTypes: {
        Charity: {
            en: 'Charity',
            cy: 'Elusen'
        },
        'Charity: All': {
            en: 'Charity: All',
            cy: 'Elusen: Pob un'
        },
        'Charitable Incorporated Organisation': {
            en: 'Charitable Incorporated Organisation',
            cy: 'Mudiad Elusennol Corfforedig'
        },
        'Charitable Trust': {
            en: 'Charitable Trust',
            cy: 'Ymddiriedolaeth Elusennol'
        },
        'Charitable Unincorporated Association': {
            en: 'Charitable Unincorporated Association',
            cy: 'Cymdeithas Elusennol Anghorfforedig'
        },
        'Charity (Royal Charter or Act of Parliament)': {
            en: 'Charity (Royal Charter or Act of Parliament)',
            cy: 'Elusen (Siarter Brenhinol neu Ddeddf Seneddol)'
        },
        'Excepted Charity': {
            en: 'Excepted Charity',
            cy: 'Elusen Eithriedig'
        },
        'Exempt Charity': {
            en: 'Exempt Charity',
            cy: 'Elusen Ddi-dreth'
        },
        'Registered Charity': {
            en: 'Registered Charity',
            cy: 'Elusen Gofrestredig'
        },
        'Company/Mutual Society': {
            en: 'Company/Mutual Society',
            cy: 'Cwmni/Cymdeithas Gydfuddiannol'
        },
        'Company/Mutual Society: All': {
            en: 'Company/Mutual Society: All',
            cy: 'Cwmni/Cymdeithas Gydfuddiannol: Pob un'
        },
        'Company - Limited by Shares': {
            en: 'Company - Limited by Shares',
            cy: 'Cwmni - Cyfyngedig trwy Gyfranddaliadau'
        },
        'CIC - Limited by Guarantee': {
            en: 'CIC - Limited by Guarantee',
            cy: 'CBC - Cyfyngedig trwy Warant'
        },
        'CIC - Limited by Shares': {
            en: 'CIC - Limited by Shares',
            cy: 'CBC - Cyfyngedig trwy Gyfranddaliadau'
        },
        'CIC - Listed Publicly': {
            en: 'CIC - Listed Publicly',
            cy: "CBC - Wedi'i Restru'n Gyhoeddus"
        },
        'Co-operative - unincorporated': {
            en: 'Co-operative - unincorporated',
            cy: 'Cydweithfa - anghorfforedig'
        },
        'Company - Limited by Guarantee': {
            en: 'Company - Limited by Guarantee',
            cy: 'Cwmni - Cyfyngedig trwy Warant'
        },
        'Company - Listed Publicly': {
            en: 'Company - Listed Publicly',
            cy: "Cwmni - Wedi'i Restru'n Gyhoeddus"
        },
        'Credit Union': {
            en: 'Credit Union',
            cy: 'Undeb Credyd'
        },
        'Friendly Society': {
            en: 'Friendly Society',
            cy: 'Cymdeithas Gyfeillgar'
        },
        'Industrial & Provident Society': {
            en: 'Industrial & Provident Society',
            cy: 'Cymdeithas Ddiwydiannol a Darbodus'
        },
        'Limited Liability Partnership': {
            en: 'Limited Liability Partnership',
            cy: 'Partneriaeth Atebolrwydd Cyfyngedig'
        },
        Other: {
            en: 'Other',
            cy: 'Arall'
        },
        'Other: All': {
            en: 'Other: All',
            cy: 'Arall: Pob un'
        },
        'Church-based faith organisation': {
            en: 'Church-based faith organisation',
            cy: 'Mudiad ffydd seiliedig mewn eglwys'
        },
        'Further / Higher Education': {
            en: 'Further / Higher Education',
            cy: 'Addysg Bellach / Uwch'
        },
        'Independent School': {
            en: 'Independent School',
            cy: 'Ysgol Annibynnol'
        },
        Individual: {
            en: 'Individual',
            cy: 'Unigolyn'
        },
        'Non charitable unincorporated organisation': {
            en: 'Non charitable unincorporated organisation',
            cy: 'Mudiad anelusennol anghorfforedig'
        },
        'Parochial Church Council': {
            en: 'Parochial Church Council',
            cy: 'Cyngor Eglwys Blwyfol'
        },
        Partnership: {
            en: 'Partnership',
            cy: 'Partneriaeth'
        },
        'Sole Trader': {
            en: 'Sole Trader',
            cy: 'Unig Fasnachwr'
        },
        University: {
            en: 'University',
            cy: 'Prifysgol'
        },
        'Public Sector': {
            en: 'Public Sector',
            cy: 'Sector Cyhoeddus'
        },
        'Public Sector: All': {
            en: 'Public Sector: All',
            cy: 'Sector Cyhoeddus: Pob un'
        },
        'Non-Departmental Public Body': {
            en: 'Non-Departmental Public Body',
            cy: 'Corff Cyhoeddus Anadrannol'
        },
        'Community Council': {
            en: 'Community Council',
            cy: 'Cyngor Cymuned'
        },
        'Fire Service': {
            en: 'Fire Service',
            cy: 'Gwasanaeth Tân'
        },
        'Health Authority': {
            en: 'Health Authority',
            cy: 'Awdurdod Iechyd'
        },
        'Local Authority': {
            en: 'Local Authority',
            cy: 'Awdurdod Lleol'
        },
        'NHS Trust - Foundation': {
            en: 'NHS Trust - Foundation',
            cy: 'Ymddiriedolaeth GIG - Sefydledig'
        },
        'NHS Trust - Non Foundation': {
            en: 'NHS Trust - Non Foundation',
            cy: 'Ymddiriedolaeth GIG - Ansefydledig'
        },
        'Parish Council': {
            en: 'Parish Council',
            cy: 'Cyngor Plwyf'
        },
        'Police Authority': {
            en: 'Police Authority',
            cy: 'Awdurdod Heddlu'
        },
        'Prison Service': {
            en: 'Prison Service',
            cy: 'Gwasanaeth Carchar'
        },
        'Town Council': {
            en: 'Town Council',
            cy: 'Cyngor Tref'
        },
        School: {
            en: 'School',
            cy: 'Ysgol'
        },
        'School: All': {
            en: 'School: All',
            cy: 'Ysgol: Pob un'
        },
        Academy: {
            en: 'Academy',
            cy: 'Academi'
        },
        'City Technology College': {
            en: 'City Technology College',
            cy: 'Coleg Technoleg Dinas'
        },
        'Community School': {
            en: 'Community School',
            cy: 'Ysgol Gymunedol'
        },
        'Foundation or Trust School': {
            en: 'Foundation or Trust School',
            cy: 'Ysgol Sefydledig neu Ymddiriedolaeth'
        },
        'State School': {
            en: 'State School',
            cy: 'Ysgol Wladol'
        },
        'Voluntary Aided School': {
            en: 'Voluntary Aided School',
            cy: 'Ysgol Wirfoddol a Gynorthwyir'
        },
        'Voluntary Controlled School': {
            en: 'Voluntary Controlled School',
            cy: 'Ysgol Wirfoddol a Reolir'
        }
    }
};

const getTranslation = (langKey, str, locale) =>
    get(translations, [langKey, str, locale], str);

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
