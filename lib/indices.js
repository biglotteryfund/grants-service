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
        options: { name: 'ID', unique: true }
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
        spec: { 'recipientOrganization.id': 1 },
        options: { name: 'recipientOrganizationId' }
    },
    {
        "spec": {
            "amountAwarded": 1,
            "awardDate": 1,
            'grantProgramme.title': 1,
            "beneficiaryLocation.country": 1,
            'beneficiaryLocation.geoCode': 1,
            'beneficiaryLocation.geoCodeType': 1,
            "recipientOrganization.organisationType": 1,
            "recipientOrganization.organisationSubtype": 1
        },
        "options": {
            "name": "FacetIndex"
        }
    }
];
