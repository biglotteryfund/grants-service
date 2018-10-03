'use strict';
const { head } = require('lodash');
const request = require('request-promise-native');

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
const COUNTRY_REGEXES = {
    england: /^E/,
    wales: /^W/,
    scotland: /^S/,
    'northern-ireland': /^N/
};

/**
 * Is postcode?
 * Matches UK postcodes only
 * @see https://github.com/chriso/validator.js/blob/master/lib/isPostalCode.js#L54
 * @param {string} input
 */
function isPostcode(input) {
    return /(gir\s?0aa|[a-zA-Z]{1,2}\d[\da-zA-Z]?\s?(\d[a-zA-Z]{2})?)/.test(
        input
    );
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
            amountAwarded: { $gte: minAmount || 0, $lte: maxAmount || Infinity }
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
        match.$and.push({
            'recipientOrganization.organisationType': {
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
     * Handle directly entered postcodes
     * If we have a text query and it looks like a postcode then
     * override the query params to consider this a postcode lookup
     */
    if (queryParams.q && isPostcode(queryParams.q) === true) {
        queryParams.postcode = queryParams.q;
        delete queryParams.q;
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
        if (queryParams.q.indexOf('"') === -1) {
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
        const postcodeData = await request({
            json: true,
            method: 'GET',
            url: `https://api.postcodes.io/postcodes/${queryParams.postcode}`,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (postcodeData && postcodeData.result) {
            match.$or = match.$or.concat([
                {
                    'beneficiaryLocation.geoCode': {
                        $in: [
                            postcodeData.result.codes.admin_district,
                            postcodeData.result.codes.admin_ward,
                            postcodeData.result.codes.parliamentary_constituency
                        ]
                    }
                }
            ]);
        }
    }

    /**
     * Country
     */
    const countryRegex =
        queryParams.country && COUNTRY_REGEXES[queryParams.country];
    if (countryRegex) {
        match.$and.push(
            { 'beneficiaryLocation.geoCode': { $regex: countryRegex } },
            { 'beneficiaryLocation.geoCodeType': 'CMLAD' }
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
function buildFacetCriteria() {
    return {
        localAuthorities: buildLocationFacet('CMLAD'),
        westminsterConstituencies: buildLocationFacet('WPC'),
        amountAwarded: [
            {
                $bucket: {
                    groupBy: '$amountAwarded',
                    boundaries: [0, 10000, 100000, 1000000, Infinity],
                    output: { count: { $sum: 1 } }
                }
            }
        ],
        awardDate: [
            {
                $group: {
                    _id: { $year: '$awardDate' },
                    count: { $sum: 1 }
                }
            }
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

/**
 * Fetch grants
 */
async function fetchGrants(collection, queryParams) {
    const perPageCount =
        (queryParams.limit && parseInt(queryParams.limit)) || 50;
    const pageParam = queryParams.page && parseInt(queryParams.page);
    const currentPage = pageParam > 1 ? pageParam : 1;
    const skipCount = perPageCount * (currentPage - 1);

    const sortCriteria = buildSortCriteria(queryParams);
    const facetCriteria = buildFacetCriteria();
    const matchCriteria = await buildMatchCriteria(queryParams);

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
     * Perform query for grant results
     */
    const grantsResult = await collection
        .aggregate(resultsPipeline, { allowDiskUse: true })
        .skip(skipCount)
        .limit(perPageCount)
        .toArray();

    /**
     * Peform a second query with $facet pipelines
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

    /**
     * Peform a separate (fast) count query to get the total results.
     */
    const totalResults = await collection.find(matchCriteria).count();

    /**
     * Pluck out the current sort type from the sort criteria
     * to allow us to return the sort as a meta key.
     */
    const currentSortType = head(Object.keys(sortCriteria));
    const currentSortDirection =
        sortCriteria[currentSortType] === 1 ? 'asc' : 'desc';

    return {
        meta: {
            totalResults: totalResults,
            query: queryParams,
            currentSort: {
                type: currentSortType,
                direction: currentSortDirection
            },
            pagination: {
                currentPage: currentPage,
                perPageCount: perPageCount,
                skipCount: skipCount,
                totalPages: Math.ceil(totalResults / perPageCount)
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
    fetchGrantById
};
