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
        options: {}
    },
    {
        spec: {'amountAwarded': 1},
        options: {}
    },
    {
        spec: {'awardDate': 1},
        options: {}
    },
    {
        spec: {'grantProgramme.title': 1},
        options: {}
    },
    {
        spec: {'recipientOrganization.organisationType': 1},
        options: {}
    },
    {
        spec: {'beneficiaryLocation.geoCode': 1},
        options: {}
    }
];
