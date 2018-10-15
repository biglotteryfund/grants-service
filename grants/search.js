'use strict';
const { head, get } = require('lodash');
const request = require('request-promise-native');
const querystring = require('querystring');
const moment = require('moment');

/**
 * 360Giving organisation prefix
 * We don't want to expose this in public urls
 * so we prepend this when doing lookups
 */
const ID_PREFIX = '360G-blf-';

/**
 * Country regular expressions
 * geocodes start with a letter prefix denoting the country
 * we use this to do country lookups.
 */
const COUNTRIES = {
    england: {
        pattern: /^E/,
        title: 'England'
    },
    wales: {
        pattern: /^W/,
        title: 'Wales'
    },
    scotland: {
        pattern: /^S/,
        title: 'Scotland'
    },
    'northern-ireland': {
        pattern: /^N/,
        title: 'Northern Ireland'
    }
};

// The type of geocode
// Source: https://github.com/ThreeSixtyGiving/standard/blob/master/codelists/geoCodeType.csv
const GEOCODE_TYPES = {
    localAuthority: 'CMLAD',
    constituency: 'WPC'
};

/**
 * Is postcode?
 * Matches UK postcodes only
 * @see https://github.com/chriso/validator.js/blob/master/lib/isPostalCode.js#L54
 * @param {string} input
 */
function isPostcode(input) {
    return input && input.match(/(gir\s?0aa|[a-zA-Z]{1,2}\d[\da-zA-Z]?\s?(\d[a-zA-Z]{2})?)/);
}

/**
 * Turns a number into a localised count
 * eg. 123456 => 123,456
 * @param {string} str
 */
function numberWithCommas(str = '') {
    const n = parseFloat(str);
    return n.toLocaleString();
}

/**
 * Build sort criteria
 * 1. Default to awardDate (newest first)
 * 2. If we have an explicit sort param use that
 * 3. Otherwise, if we're performing a text search sort by score
 * @param {object} queryParams
 */
function buildSortCriteria(queryParams) {
    let sortConf = { awardDate: -1 };
    if (queryParams.sort) {
        const [field, direction] = queryParams.sort.split('|');
        if (['awardDate', 'amountAwarded'].indexOf(field) !== -1) {
            const newSortConf = {};
            newSortConf[field] = direction === 'asc' ? 1 : -1;
            sortConf = newSortConf;
        }
    } else if (queryParams.q) {
        sortConf = {
            score: {
                $meta: 'textScore'
            }
        };
    }

    return sortConf;
}

/**
 * Build $match criteria
 * @see https://docs.mongodb.com/manual/reference/operator/aggregation/match/index.html
 * @param {object} queryParams
 */
async function buildMatchCriteria(queryParams) {
    const match = {};

    match.$and = [];
    match.$or = [];

    /**
     * Default criteria
     * $facet pipelines must have at least one match in order to
     * use the index so we set something here that matches everything.
     */
    match.$and.push({
        awardDate: { $exists: true }
    });
    /**
     * Grant amount
     * Allow a min and max amount separated by a pipe.
     */
    if (queryParams.amount) {
        const [minAmount, maxAmount] = queryParams.amount
            .split('|')
            .map(num => parseInt(num, 10));
        match.$and.push({
            amountAwarded: { $gte: minAmount || 0, $lt: maxAmount || Infinity }
        });
    }

    /**
     * Award date year
     */
    if (queryParams.year) {
        var start = new Date(queryParams.year, 0, 1);
        var end = new Date(queryParams.year, 11, 31);

        match.$and.push({
            awardDate: { $gte: start, $lt: end }
        });
    }

    /**
     * Programme title
     */
    if (queryParams.programme) {
        match.$and.push({
            'grantProgramme.title': {
                $eq: queryParams.programme
            }
        });
    }

    /**
     * Organisation type
     */
    if (queryParams.orgType) {
        match.$or.push(
            {
                'recipientOrganization.organisationType': {
                    $regex: `^${queryParams.orgType}`,
                    $options: 'i'
                }
            },
            {
                'recipientOrganization.organisationSubtype': {
                    $regex: `^${queryParams.orgType}`,
                    $options: 'i'
                }
            });
    }

    /**
     * Local authority
     */
    if (queryParams.localAuthority) {
        match.$and.push({
            'beneficiaryLocation.geoCode': queryParams.localAuthority
        });
    }

    /**
     * Westminster Constituency
     */
    if (queryParams.constituency) {
        match.$and.push({
            'beneficiaryLocation.geoCode': queryParams.constituency
        });
    }

    /**
     * Recipient
     */
    if (queryParams.recipient) {
        match.$and.push({
            'recipientOrganization.id': queryParams.recipient
        });
    }

    if (queryParams.exclude) {
        match.$and.push({
            'id': {
                $not: {
                    $eq: queryParams.exclude
                }
            }
        });
    }

    /**
     * Search queries
     *
     * We want search terms to be treated as logical AND querries.
     * By default mongodb peforms as logical OR search of the terms unless specified as a phrase.
     * To get the behaviour we want we need to convert each query word into a "phrase" by wrapping
     * it in quotes. From the docs:
     *
     * If the $search string includes a phrase and individual terms, text search will only
     * match the documents that include the phrase. More specifically, the search performs a
     * logical AND of the phrase with the individual terms in the search string.
     * @see https://docs.mongodb.com/manual/reference/operator/query/text/index.html
     */
    if (queryParams.q) {
        if (queryParams.q.indexOf('"') === -1 && !queryParams.related) {
            queryParams.q = queryParams.q
                .split(' ')
                .map(term => {
                    // Don't wrap it in quotes if this is negation
                    return /^-/.test(term) ? term : `"${term}"`;
                })
                .join(' ');
        }

        match.$text = {
            $search: queryParams.q
        };
    }

    /**
     * Postcode
     * Lookup geocodes for postcode from postcodes.io
     */
    if (queryParams.postcode) {
        console.log('fetching data from api.postcodes.io');
        try {
            const postcodeData = await request({
                json: true,
                method: 'GET',
                url: `https://api.postcodes.io/postcodes?q=${queryParams.postcode}`,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (postcodeData && postcodeData.result) {
                const firstMatch = postcodeData.result[0];
                match.$or = match.$or.concat([
                    {
                        'beneficiaryLocation.geoCode': {
                            $in: [
                                firstMatch.codes.admin_district,
                                firstMatch.codes.admin_ward,
                                firstMatch.codes.parliamentary_constituency
                            ]
                        }
                    }
                ]);
            }
        } catch (requestError) {
            console.error(requestError);
            if (requestError.error.error === 'Invalid postcode') {
                throw new Error('InvalidPostcode');
            } else {
                throw new Error('PostcodeApiFailure');
            }
        }
    }

    /**
     * Country
     */
    const countryRegex =
        queryParams.country && COUNTRIES[queryParams.country];
    if (countryRegex) {
        match.$and.push(
            { 'beneficiaryLocation.geoCode': { $regex: countryRegex.pattern } },
            { 'beneficiaryLocation.geoCodeType': GEOCODE_TYPES.localAuthority }
        );
    }

    /**
     * $and and $or cannot be empty arrays
     * so delete them if they are empty
     */
    if (match.$and.length === 0) delete match.$and;
    if (match.$or.length === 0) delete match.$or;

    return match;
}

/**
 * Build location facet
 * Construct a facet object based on a geoCodeType
 * @param {string} geoCodeType
 */
function buildLocationFacet(geoCodeType) {
    return [
        {
            $project: {
                items: {
                    $filter: {
                        input: '$beneficiaryLocation',
                        as: 'location',
                        cond: { $eq: ['$$location.geoCodeType', geoCodeType] }
                    }
                }
            }
        },
        {
            $group: {
                _id: {
                    $arrayElemAt: ['$items.name', 0]
                },
                code: { $first: { $arrayElemAt: ['$items.geoCode', 0] } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ];
}

/**
 * Build $facet criteria
 * @see https://docs.mongodb.com/manual/reference/operator/aggregation/facet/index.html
 */

const AMOUNT_AWARDED_BUCKETS = [0, 10000, 50000, 100000, 1000000, Infinity];

function buildFacetCriteria() {
    return {

        countries: [
            {
                $project: {
                    items: {
                        $filter: {
                            input: '$beneficiaryLocation',
                            as: 'location',
                            cond: { $eq: ['$$location.geoCodeType', GEOCODE_TYPES.localAuthority] }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $substrBytes: [
                            { $arrayElemAt: ['$items.geoCode', 0] },
                            0,
                            1
                        ]
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ],

        amountAwarded: [
            {
                $bucket: {
                    groupBy: '$amountAwarded',
                    boundaries: AMOUNT_AWARDED_BUCKETS,
                    output: {
                        count: { $sum: 1 }
                    }
                }
            },
        ],

        localAuthorities: buildLocationFacet(GEOCODE_TYPES.localAuthority),
        westminsterConstituencies: buildLocationFacet(GEOCODE_TYPES.constituency),
        awardDate: [
            {
                $group: {
                    _id: { $year: '$awardDate' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: -1 } }
        ],
        grantProgramme: [
            {
                $group: {
                    _id: { $arrayElemAt: ['$grantProgramme.title', 0] },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ],
        orgType: [
            {
                $group: {
                    _id: {
                        $arrayElemAt: [
                            '$recipientOrganization.organisationType',
                            0
                        ]
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]
    };
}

async function fetchFacets(collection, matchCriteria = {}, ) {
    const facetCriteria = buildFacetCriteria();

    /**
     * Perform a second query with $facet pipelines
     * No limit or skip set as we want facets for the full result set.
     */
    const facetsResult = await collection
        .aggregate([{ $match: matchCriteria }, { $facet: facetCriteria }])
        .toArray();

    /**
     * $facets results are always returned as an array
     * Pluck out the first (and in our case only) item
     */
    const facets = head(facetsResult);

    // Tweak the amountAwarded facet for the custom UI
    facets.amountAwarded = facets.amountAwarded.map(amount => {
        // Try to find the next bucket item after this one
        let lowerBound = amount._id;
        let upperBound = AMOUNT_AWARDED_BUCKETS[AMOUNT_AWARDED_BUCKETS.indexOf(lowerBound) + 1];

        // We don't use Infinity in the UI so ignore it here
        if (upperBound === Infinity) {
            upperBound = undefined;
        }

        // Build a title string
        let title;
        if (lowerBound === 0 && upperBound) {
            title = `Under £${numberWithCommas(upperBound)}`;
        } else if (!upperBound) {
            title = `£${numberWithCommas(lowerBound)}+`;
        } else {
            title = `£${numberWithCommas(lowerBound)}–£${numberWithCommas(upperBound)}`;
        }
        amount.title = title;

        // Construct a value string for the filter parameter
        amount.value = lowerBound;
        if (upperBound) {
            amount.value += `|${upperBound}`;
        }

        return amount;
    });

    // Enhance country facet by adding in the proper name
    // and filtering out any non-standard ones (eg. the country "9")
    facets.countries = facets.countries.map(countryFacet => {
        let isValid = false;
        for (let countryKey in COUNTRIES) {
            const country = COUNTRIES[countryKey];
            isValid = country.pattern.test(countryFacet._id);
            if (isValid) {
                countryFacet.name = country.title;
                countryFacet.value = countryKey;
                break;
            }
        }
        return countryFacet;
    }).filter(c => !!c.name);

    // Strip out empty locations from missing geocodes
    facets.localAuthorities = facets.localAuthorities.filter(f => !!f._id);
    facets.westminsterConstituencies = facets.westminsterConstituencies.filter(f => !!f._id);

    return facets;
}

/**
 * Fetch grants
 */
async function fetchGrants(mongo, queryParams) {
    const start = moment();
    const perPageCount =
        (queryParams.limit && parseInt(queryParams.limit)) || 50;
    const pageParam = queryParams.page && parseInt(queryParams.page);
    const currentPage = pageParam > 1 ? pageParam : 1;
    const skipCount = perPageCount * (currentPage - 1);

    /**
     * Handle directly entered postcodes
     * If we have a text query and it looks like a postcode then
     * override the query params to consider this a postcode lookup
     */
    const postcodeSearch = isPostcode(queryParams.q);
    if (queryParams.q && postcodeSearch) {
        let postcode = postcodeSearch[0];
        queryParams.q = queryParams.q.replace(postcode, '');
        queryParams.postcode = postcode;
    } else {
        delete queryParams.postcode;
    }

    const matchCriteria = await buildMatchCriteria(queryParams);
    const sortCriteria = buildSortCriteria(queryParams);

    /**
     * Construct the aggregation pipeline
     * Includes stripping 360Giving organisation prefix
     * from the public ID field.
     */
    const resultsPipeline = [
        { $match: matchCriteria },
        { $sort: sortCriteria },
        {
            $addFields: {
                id: {
                    $arrayElemAt: [{ $split: ['$id', ID_PREFIX] }, 1]
                }
            }
        }
    ];

    /**
     * Expose the search score as a custom field
     */
    if (queryParams.q) {
        resultsPipeline.push({
            $addFields: {
                _textScore: { $meta: 'textScore' }
            }
        });
    }

    /**
     * Perform a separate (fast) count query to get the total results.
     */
    const totalGrants = await mongo.grantsCollection.find({}).count();
    const totalGrantsForQuery = await mongo.grantsCollection.find(matchCriteria).count();
    let totalAwarded = await mongo.grantsCollection.aggregate([
        { $match: matchCriteria  },
        { $group: { _id : null, sum : { $sum: "$amountAwarded" } } },
        { $project: { _id: 0, sum: 1 } }
    ]).toArray();
    totalAwarded = get(totalAwarded, '[0].sum', false);

    /**
     * Perform query for grant results
     */
    const grantsResult = await mongo.grantsCollection
        .aggregate(resultsPipeline, { allowDiskUse: true })
        .skip(skipCount)
        .limit(perPageCount)
        .toArray();

    const shouldUseCachedFacets = totalGrants === totalGrantsForQuery;

    let facets;

    if (!queryParams.related) {
        facets = shouldUseCachedFacets ?
            await mongo.facetsCollection.findOne() :
            await fetchFacets(mongo.grantsCollection, matchCriteria);
    }

    /**
     * Pluck out the current sort type from the sort criteria
     * to allow us to return the sort as a meta key.
     */
    const currentSortType = head(Object.keys(sortCriteria));
    const currentSortDirection =
        sortCriteria[currentSortType] === 1 ? 'asc' : 'desc';

    const end = moment();

    return {
        meta: {
            usingFacetCache: shouldUseCachedFacets,
            timeToRenderMs: queryParams.perf ? end.diff(start) : null,
            totalResults: totalGrantsForQuery,
            totalAwarded: totalAwarded,
            query: queryParams,
            currentSort: {
                type: currentSortType,
                direction: currentSortDirection
            },
            pagination: {
                currentPage: currentPage,
                perPageCount: perPageCount,
                skipCount: skipCount,
                totalPages: Math.ceil(totalGrantsForQuery / perPageCount),
                get prevPageParams() {
                    if (this.totalPages > 1 && this.currentPage > 1) {
                        return querystring.stringify(Object.assign({}, queryParams, {
                            page: this.currentPage - 1
                        }));
                    }
                    return undefined;
                },
                get nextPageParams() {
                    if (this.totalPages > 1 && this.currentPage < this.totalPages) {
                        return querystring.stringify(Object.assign({}, queryParams, {
                            page: this.currentPage + 1
                        }));
                    }
                    return undefined;
                }
            }
        },
        facets: facets,
        results: grantsResult
    };
}

/**
 * Fetch grant by ID
 * Accepts an ID without the 360Giving prefix
 * We don't want to expose this in public urls
 * so we prepend this when doing lookups
 */
function fetchGrantById(collection, id) {
    return collection.findOne({
        id: `${ID_PREFIX}${id}`
    });
}

module.exports = {
    fetchGrants,
    fetchGrantById,
    fetchFacets
};
