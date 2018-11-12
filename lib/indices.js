'use strict';
module.exports = [
    {
        spec: {
            title: 'text',
            description: 'text',
            'recipientOrganization.name': 'text',
            'beneficiaryLocation.name': 'text'
        },
        options: {
            weights: {
                title: 5,
                'recipientOrganization.name': 5,
                'beneficiaryLocation.name': 5,
                description: 2
            },
            name: 'TextIndex'
        }
    },
    {
        spec: { id: 1 },
        options: { name: 'ID' }
    },
    {
        spec: { awardDate: 1 },
        options: { name: 'DateAsc' }
    },
    {
        spec: { awardDate: -1 },
        options: { name: 'DateDesc' }
    },
    {
        spec: { amountAwarded: 1 },
        options: { name: 'AmountAsc' }
    },
    {
        spec: { amountAwarded: -1 },
        options: { name: 'AmountDesc' }
    },
    {
        spec: { 'grantProgramme.title': 1 },
        options: { name: 'programmeTitle' }
    },
    {
        spec: { 'recipientOrganization.organisationType': 1 },
        options: { name: 'organisationType' }
    },
    {
        spec: { 'recipientOrganization.organisationSubtype': 1 },
        options: { name: 'organisationSubtype' }
    },
    {
        spec: { 'beneficiaryLocation.geoCode': 1 },
        options: { name: 'geoCode' }
    },
    {
        spec: { 'beneficiaryLocation.geoCodeType': 1 },
        options: { name: 'geoCodeType' }
    },
    {
        spec: { 'recipientOrganization.id': 1 },
        options: { name: 'recipientOrganizationId' }
    },
    // Suggested indices via Mongo Cloud
    {
        "spec": {
            "beneficiaryLocation.country": 1,
            "amountAwarded": 1,
            "awardDate": 1,
            "recipientOrganization.organisationSubtype": 1
        },
        "options": {
            "name": "SuggestedIndex1"
        }
    },
    {
        "spec": {
            "beneficiaryLocation.country": 1,
            "amountAwarded": 1,
            "awardDate": 1,
            "recipientOrganization.organisationType": 1
        },
        "options": {
            "name": "SuggestedIndex2"
        }
    },
    {
        "spec": {
            "grantProgramme.title": 1,
            "awardDate": 1,
            "recipientOrganization.organisationSubtype": 1
        },
        "options": {
            "name": "SuggestedIndex3"
        }
    },
    {
        "spec": {
            "grantProgramme.title": 1,
            "awardDate": 1,
            "recipientOrganization.organisationType": 1
        },
        "options": {
            "name": "SuggestedIndex4"
        }
    },
    {
        "spec": {
            "beneficiaryLocation.country": 1,
            "awardDate": 1,
            "recipientOrganization.organisationSubtype": 1
        },
        "options": {
            "name": "SuggestedIndex5"
        }
    },
    {
        "spec": {
            "beneficiaryLocation.country": 1,
            "awardDate": 1,
            "recipientOrganization.organisationType": 1
        },
        "options": {
            "name": "SuggestedIndex6"
        }
    },
    {
        "spec": {
            "beneficiaryLocation.country": 1,
            "grantProgramme.title": 1,
            "amountAwarded": 1,
            "awardDate": 1,
            "recipientOrganization.organisationType": 1
        },
        "options": {
            "name": "SuggestedIndex7"
        }
    },
    {
        "spec": {
            "beneficiaryLocation.country": 1,
            "grantProgramme.title": 1,
            "amountAwarded": 1,
            "awardDate": 1,
            "recipientOrganization.organisationSubtype": 1
        },
        "options": {
            "name": "SuggestedIndex8"
        }
    },
    {
        "spec": {
            "amountAwarded": 1,
            "awardDate": 1,
            "recipientOrganization.organisationType": 1
        },
        "options": {
            "name": "SuggestedIndex9"
        }
    },
    {
        "spec": {
            "amountAwarded": 1,
            "awardDate": 1,
            "recipientOrganization.organisationSubtype": 1
        },
        "options": {
            "name": "SuggestedIndex10"
        }
    },
    {
        "spec": {
            "awardDate": 1,
            "recipientOrganization.organisationSubtype": 1
        },
        "options": {
            "name": "SuggestedIndex11"
        }
    }
];
