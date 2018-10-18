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
    }
];
