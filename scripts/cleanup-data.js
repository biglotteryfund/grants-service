#!/usr/bin/env node
'use strict';
const fs = require('fs');
const JSONStream = require('JSONStream');
const es = require('event-stream');
const moment = require('moment');
const _ = require('lodash');

const argv = require('yargs')
    .alias('f', 'file')
    .describe('f', 'The path to a JSON file to clean')
    .alias('o', 'output')
    .describe('b', 'The path to the JSON file to output')
    .help('h')
    .alias('h', 'help').argv;

const exitWithMessage = msg => {
    console.log(msg);
    process.exit(1);
};

if (!argv.f) {
    exitWithMessage('Exiting: the -f / --file parameter is required.');
}

// Turn date fields into actual Date objects
const parseDates = data => {
    const dateFields = [
        'Award Date',
        'Planned Dates:Start Date',
        'Planned Dates:End Date'
    ];
    dateFields.forEach(dateField => {
        if (data[dateField]) {
            let d = moment(data[dateField].trim(), 'YYYY-MM-DD');
            data[dateField] = d.toDate();
        }
    });
    return data;
};

// Split organisation strings into proper structures
const separateOrgType = data => {
    const orgTypeKey = 'BIGField_Organisation_Type';
    if (data[orgTypeKey]) {
        const parts = data[orgTypeKey].split(' : ');
        data.organisationType = data[orgTypeKey];
        delete data[orgTypeKey];
        if (parts.length > 1) {
            data.organisationType = parts[0];
            data.organisationSubtype = parts[1];
        }
    }
    return data;
};

// Rename the fields to something more useful
// and drop unused fields
const rename = data => {
    let newData = {
        identifier: data['Identifier'],
        recipient: {
            name: data['Recipient Org:Name'],
            projectTitle: data['Title'],
            projectDescription: data['Description'],
            identifier: data['Recipient Org:Identifier'],
            charityNumber: data['Recipient Org:Charity Number'],
            companyNumber: data['Recipient Org:Company Number']
        },
        award: {
            amount: data['Amount Awarded'],
            awarded: data['Award Date'],
            plannedStart: data['Planned Dates:Start Date'],
            plannedEnd: data['Planned Dates:End Date'],
            grantProgramme: {
                code: data['Grant Programme:Code'],
                title: data['Grant Programme:Title']
            },
        },
        organisation: {
            type: data['organisationType'],
            subtype: data['organisationSubtype'],
        },
        location: {
            primary: {
                name: data['Recipient Org:Location:0:Name'],
                geocode: data['Recipient Org:Location:0:Geographic Code']

            },
            secondary: {
                name: data['Recipient Org:Location:1:Name'],
                geocode: data['Recipient Org:Location:1:Geographic Code']
            }
        }
    };
    // Strip out null / undefined
    return _.pickBy(newData, _.identity);

};

const finalData = [];

const getStream = () => {
    const stream = fs.createReadStream(argv.f, {
        encoding: 'utf8'
    });
    const parser = JSONStream.parse('*');
    return stream.pipe(parser);
};

getStream().pipe(es.mapSync(data => {
    const newData = [data]
        .map(parseDates)
        .map(separateOrgType)
        .map(rename);
    finalData.push(newData);
    console.log(JSON.stringify(newData, null, 4));
}));



