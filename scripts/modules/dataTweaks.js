'use strict';

// Programmes whose public-facing name differs from the internal one
const programmesToRename = [
    {
        from: 'UK Accelerating Ideas',
        to: 'UK Portfolio',
    },
    {
        from: 'Fulfilling lives: HeadStart',
        to: 'Fulfilling Lives: HeadStart',
    },
];

// Programmes we don't display on the website
// (eg. due to intra-funder transfers)
const invalidProgrammeCodes = ['PFP1'];

// Grants which shouldn't be listed due to incomplete status
const invalidGrantIds = ['360G-blf-0031057998', '360G-blf-0031059356'];

module.exports = {
    programmesToRename,
    invalidProgrammeCodes,
    invalidGrantIds,
};
