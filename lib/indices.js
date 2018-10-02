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
        options: {
            name: 'ID'
        }
    },
    {
        spec: { awardDate: -1 },
        options: {
            name: 'SortAwardDate'
        }
    },
    {
        spec: { amountAwarded: 1 },
        options: {
            name: 'SortAmountAwarded'
        }
    }
];
