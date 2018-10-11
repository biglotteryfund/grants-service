'use strict';
const allProgrammes = require('./allProgrammes.json');
const dbProgrammes = require('./dbProgrammes.json');
const stringSimilarity = require('string-similarity');
const allTitles = allProgrammes.map(p => p.title);

let totalMatches = 0;
const fixed = dbProgrammes.grantProgrammes.map(programme => {
    // const match = allProgrammes.find(p => p.title === programme._id);
    const match = allProgrammes.find(p => p.title.toLowerCase().indexOf(programme._id.toLowerCase()) !== -1);

    if (match) {
        const path = match.url.replace('www.biglotteryfund.org.uk', '');
        totalMatches = totalMatches + 1;
        programme.urlPath = path;
        // console.log(`${programme._id} = ${path}`);
    } else {
        const similarityScore = stringSimilarity.findBestMatch(programme._id, allTitles);
        const searchUrl = `https://www.google.co.uk/search?q=site%3Abiglotteryfund.org.uk+${encodeURIComponent(programme._id)}`;
        console.log(`No match for ${programme._id} - ${searchUrl}`);
        // console.log(similarityScore.ratings.filter(s => s.rating > 0.5));
        programme.urlPath = programme._id;
    }
    return programme;
});

// console.log(JSON.stringify(fixed, null, 4));
console.log(`Found ${totalMatches} / ${dbProgrammes.grantProgrammes.length} matches`);
