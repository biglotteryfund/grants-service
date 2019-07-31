/* eslint-disable no-console */
'use strict';
const moment = require('moment');
const querystring = require('querystring');
const request = require('request-promise-native');
const compact = require('lodash/compact');
const difference = require('lodash/difference');
const flow = require('lodash/flow');
const get = require('lodash/get');
const getFp = require('lodash/fp/get');
const groupBy = require('lodash/groupBy');
const has = require('lodash/has');
const head = require('lodash/head');
const sortBy = require('lodash/sortBy');

const checkSpelling = require('../lib/check-spelling');
const fundingProgrammes = require('../data/fundingProgrammes');
const { GEOCODE_TYPES } = require('../lib/geocodes');
const { getTranslation, translateLabels } = require('../translations');
const { matchPostcode, numberWithCommas } = require('../lib/strings');

/**
 * 360Giving organisation prefix
 * We don't want to expose this in public urls
 * so we prepend this when doing lookups
 */
const ID_PREFIX = '360G-blf-';

const now = moment();
const URL_DATE_FORMAT = 'YYYY-MM-DD';

const COMMON_WORDS = [
    'group',
    'project',
    'communities',
    'community',
    'organisation',
    'organisations',
    'fund',
    'people',
    'active',
    'grant',
    'grants',
    'school',
    'award',
    'local'
];

const DEFAULT_SORT = {
    criteria: { awardDate: -1 },
    value: 'awardDate|desc'
};

const DEFAULT_SORT_QUERY = {
    criteria: { score: { $meta: 'textScore' } },
    value: 'score|desc'
};

/**
 * Build sort criteria
 * 1. Default to awardDate (newest first)
 * 2. If we have an explicit sort param use that
 * 3. Otherwise, if we're performing a text search sort by score
 * @param {object} queryParams
 */
function determineSort(queryParams) {
    let sort = DEFAULT_SORT;
    if (queryParams.sort) {
        const [field, direction] = queryParams.sort.split('|');
        if (['awardDate', 'amountAwarded'].indexOf(field) !== -1) {
            const criteria = {};
            criteria[field] = direction === 'asc' ? 1 : -1;

            sort = {
                criteria: criteria,
                value: queryParams.sort
            };
        }
    } else if (queryParams.q) {
        sort = DEFAULT_SORT_QUERY;
    }

    return sort;
}

function buildSortMeta(sort, queryParams) {
    const locale = queryParams.locale || 'en';
    const langKey = 'sortOptions';

    const sortOptions = [
        {
            label: getTranslation(langKey, 'Most recent', locale),
            value: 'awardDate|desc'
        },
        {
            label: getTranslation(langKey, 'Oldest first', locale),
            value: 'awardDate|asc'
        },
        {
            label: getTranslation(langKey, 'Lowest amount first', locale),
            value: 'amountAwarded|asc'
        },
        {
            label: getTranslation(langKey, 'Highest amount first', locale),
            value: 'amountAwarded|desc'
        }
    ];

    if (queryParams.q) {
        sortOptions.unshift({
            label: getTranslation(langKey, 'Most relevant', locale),
            value: 'score|desc'
        });
    }

    return {
        defaultSort: queryParams.q
            ? DEFAULT_SORT_QUERY.value
            : DEFAULT_SORT.value,
        activeSort: sort.value,
        sortOptions: sortOptions
    };
}

// Add an active status to currently-running projects
function addActiveStatus({ grant, locale }) {
    const endDate = get(grant, 'plannedDates[0].endDate', false);
    if (endDate) {
        grant.isActive = !moment(endDate).isBefore(now);
    }
    return { grant, locale };
}

// Try to add a URL to the funding programme where one matches
function addFundingProgrammeDetail({ grant, locale }) {
    const mainProgramme = grant.grantProgramme;
    if (mainProgramme) {
        const programme = get(fundingProgrammes, mainProgramme.code, false);
        if (programme && programme.urlPath) {
            mainProgramme.url = programme.urlPath;
        }
    }
    return { grant, locale };
}

// Translate the organisation types in the data itself as well as the facets
function translateOrgTypes({ grant, locale }) {
    grant.recipientOrganization.organisationType = getTranslation(
        'orgTypes',
        grant.recipientOrganization.organisationType,
        locale
    );
    grant.recipientOrganization.organisationSubtype = getTranslation(
        'orgTypes',
        grant.recipientOrganization.organisationSubtype,
        locale
    );
    return { grant, locale };
}

// @TODO establish if this fixes slow queries and stop using arrays at both ends
// Hackily re-create existing array structure to avoid rewriting templates for now
function makeObjectsArrays({ grant, locale }) {
    ['recipientOrganization', 'fundingOrganization', 'grantProgramme'].forEach(
        field => {
            grant[field] = [grant[field]];
        }
    );
    return { grant, locale };
}

// Append/extend a few more fields once we've retrieved them
function addGrantDetail(grant, locale) {
    const detail = flow(
        addActiveStatus,
        addFundingProgrammeDetail,
        translateOrgTypes,
        makeObjectsArrays
    )({ grant: grant, locale: locale });
    return detail.grant;
}

function makeDateRange(monthsAgo) {
    // Without .clone(), moment mutates the original $now
    const end = now.clone();
    const start = now.clone().subtract(monthsAgo, 'months');
    return [start, end];
}

async function getSearchSuggestions(locale, totalGrantsForQuery, queryParams) {
    let result = [];
    if (totalGrantsForQuery === 0 && queryParams.q) {
        try {
            result = await checkSpelling({
                searchTerm: queryParams.q,
                locale: locale
            });
        } catch (e) {
            console.error(e);
        }
    }

    return result;
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
     * Award date range
     * Handle last 3 and last 6 months as presets
     * Otherwise accept date range in the form yyyy-mm-dd|yyyy-mm-dd
     */
    if (queryParams.awardDate) {
        let start, end;
        if (/last3months/i.test(queryParams.awardDate)) {
            [start, end] = makeDateRange(3);
        } else if (/last6months/i.test(queryParams.awardDate)) {
            [start, end] = makeDateRange(6);
        } else {
            [start, end] = queryParams.awardDate
                .split('|')
                .map(str => moment(str));
        }

        if (start && end) {
            // Ensure the end date is always the last second of the day
            end = end.set({ hour: 23, minute: 59, second: 59 });
            match.$and.push({
                awardDate: { $gte: start.toDate(), $lt: end.toDate() }
            });
        }
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
            }
        );
    }

    /**
     * Local authority
     */
    if (queryParams.localAuthority) {
        match.$and.push({
            beneficiaryLocation: {
                $elemMatch: {
                    geoCode: queryParams.localAuthority,
                    geoCodeType: GEOCODE_TYPES.localAuthority
                }
            }
        });
    }

    /**
     * Westminster Constituency
     */
    if (queryParams.westminsterConstituency) {
        match.$and.push({
            beneficiaryLocation: {
                $elemMatch: {
                    geoCode: queryParams.westminsterConstituency,
                    geoCodeType: GEOCODE_TYPES.constituency
                }
            }
        });
    }

    /**
     * Recipient
     */
    if (queryParams.recipient) {
        match.$and.push({
            'recipientOrganization.id': {
                $eq: queryParams.recipient
            }
        });
    }

    if (queryParams.exclude) {
        match.$and.push({
            id: {
                $not: {
                    $eq: queryParams.exclude
                }
            }
        });
    }

    /**
     * Search queries
     *
     * We want search terms to be treated as logical AND queries.
     * By default mongodb performs as logical OR search of the terms unless specified as a phrase.
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
            // Split our query into words and make it lowercase
            let terms = queryParams.q.split(' ').map(s => s.toLowerCase());
            // Exclude common words from the query
            let termsMinusCommon = difference(terms, COMMON_WORDS);
            if (termsMinusCommon.length !== 0) {
                terms = termsMinusCommon;
            }
            // Quote each word (eg. AND search)
            terms = terms.map(term => {
                // Don't wrap a word in quotes if this is negation
                return /^-/.test(term) ? term : `"${term}"`;
            });
            // Reassemble the string
            queryParams.q = terms.join(' ');
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
        try {
            const postcodeData = await request({
                json: true,
                method: 'GET',
                url: `https://api.postcodes.io/postcodes?q=${
                    queryParams.postcode
                }`,
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
    const validCountries = ['England', 'Northern Ireland', 'Scotland', 'Wales'];
    if (
        queryParams.country &&
        validCountries.indexOf(queryParams.country) !== -1
    ) {
        match.$and.push({ 'beneficiaryLocation.country': queryParams.country });
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
        { $sort: { _id: 1 } },
        { $project: { label: '$_id', value: '$code', count: 1 } }
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
                $group: {
                    _id: { $arrayElemAt: ['$beneficiaryLocation.country', 0] },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $project: { count: 1, label: '$_id', value: '$_id' } }
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
            }
        ],

        localAuthorities: buildLocationFacet(GEOCODE_TYPES.localAuthority),

        westminsterConstituencies: buildLocationFacet(
            GEOCODE_TYPES.constituency
        ),

        awardDate: [
            {
                $group: {
                    _id: { $year: '$awardDate' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: -1 } },
            { $project: { count: 1, label: '$_id', value: '$_id' } }
        ],

        grantProgramme: [
            {
                $group: {
                    _id: '$grantProgramme.title',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $project: { count: 1, label: '$_id', value: '$_id' } }
        ],

        orgType: [
            {
                $group: {
                    _id: {
                        type: '$recipientOrganization.organisationType',
                        subtype: '$recipientOrganization.organisationSubtype'
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            { $project: { count: 1, label: '$_id.type', value: '$_id.type' } }
        ]
    };
}

async function fetchFacets(
    collection,
    matchCriteria = {},
    locale,
    grantResults = false
) {
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
        let upperBound =
            AMOUNT_AWARDED_BUCKETS[
                AMOUNT_AWARDED_BUCKETS.indexOf(lowerBound) + 1
            ];

        // We don't use Infinity in the UI so ignore it here
        if (upperBound === Infinity) {
            upperBound = undefined;
        }

        let label;
        if (lowerBound === 0 && upperBound) {
            const under = getTranslation('misc', 'Under', locale);
            label = `${under} £${numberWithCommas(upperBound)}`;
        } else if (!upperBound) {
            label = `£${numberWithCommas(lowerBound)}+`;
        } else {
            label = `£${numberWithCommas(lowerBound)}–£${numberWithCommas(
                upperBound - 1
            )}`;
        }

        amount.label = label;

        // Construct a value string for the filter parameter
        amount.value = lowerBound;
        if (upperBound) {
            amount.value += `|${upperBound}`;
        }

        return amount;
    });

    // Combine org types
    facets.orgType = facets.orgType.filter(f => !!f.value);
    let orgGroups = groupBy(facets.orgType, f => {
        return getTranslation('orgTypes', f._id.type, locale);
    });
    for (let parentGroup in orgGroups) {
        let total = 0;
        orgGroups[parentGroup] = orgGroups[parentGroup]
            .map(group => {
                total += group.count;
                const name = group._id.subtype;
                return {
                    _id: name,
                    count: group.count,
                    label: name,
                    value: name
                };
            })
            .sort((a, b) => a.label > b.label);

        // Add an overall count at the start
        const parentAll = `${parentGroup}: All`;
        orgGroups[parentGroup].unshift({
            _id: parentAll,
            count: total,
            label: parentAll,
            value: parentGroup
        });

        orgGroups[parentGroup] = orgGroups[parentGroup].map(
            translateLabels('orgTypes', locale)
        );
    }
    facets.orgType = orgGroups;

    /**
     * Convert date facets into ranges
     */
    const awardDateOptions = facets.awardDate.map(awardDate => {
        const year = awardDate.value;
        const start = moment(new Date(year, 0, 1)).format(URL_DATE_FORMAT);
        const end = moment(new Date(year, 11, 31)).format(URL_DATE_FORMAT);
        awardDate.value = `${start}|${end}`;
        return awardDate;
    });

    /**
     * Add dynamic date filters (eg. 3 months, 6 months ago)
     * Only add if the results set allows this
     */
    if (grantResults) {
        const newestGrant = head(sortBy(grantResults, 'awardDate').reverse());

        if (newestGrant) {
            const monthsAgo = now.diff(moment(newestGrant.awardDate), 'months');

            if (monthsAgo < 6) {
                awardDateOptions.unshift({
                    _id: `last6Months`,
                    label: getTranslation('misc', `Last six months`, locale),
                    value: 'last6Months'
                });
            }

            if (monthsAgo < 3) {
                awardDateOptions.unshift({
                    _id: `last3Months`,
                    label: getTranslation('misc', `Last three months`, locale),
                    value: 'last3Months'
                });
            }
        }
    }

    facets.awardDate = awardDateOptions;

    // Strip out empty locations from missing geocodes
    facets.countries = facets.countries
        .filter(f => !!f._id)
        .map(translateLabels('countries', locale));

    facets.localAuthorities = facets.localAuthorities
        .filter(f => !!f._id)
        .map(translateLabels('localAuthorities', locale));

    facets.westminsterConstituencies = facets.westminsterConstituencies
        .filter(f => !!f._id)
        .map(translateLabels('westminsterConstituencies', locale));

    return facets;
}

function buildPagination(
    currentPage,
    perPageCount,
    skipCount,
    totalGrantsForQuery,
    queryParams
) {
    return {
        currentPage: currentPage,
        perPageCount: perPageCount,
        skipCount: skipCount,
        totalPages: Math.ceil(totalGrantsForQuery / perPageCount),
        get prevPageParams() {
            if (this.totalPages > 1 && this.currentPage > 1) {
                return querystring.stringify(
                    Object.assign({}, queryParams, {
                        page: this.currentPage - 1
                    })
                );
            }
            return undefined;
        },
        get nextPageParams() {
            if (this.totalPages > 1 && this.currentPage < this.totalPages) {
                return querystring.stringify(
                    Object.assign({}, queryParams, {
                        page: this.currentPage + 1
                    })
                );
            }
            return undefined;
        }
    };
}

async function fetchTotalAwarded(grantsCollection, matchCriteria) {
    let totalAwarded = await grantsCollection
        .aggregate([
            { $match: matchCriteria },
            { $group: { _id: null, sum: { $sum: '$amountAwarded' } } },
            { $project: { _id: 0, sum: 1 } }
        ])
        .toArray();
    totalAwarded = get(totalAwarded, '[0].sum', false);
    return totalAwarded;
}

/**
 * Fetch grants
 */
async function fetchGrants(mongo, locale = 'en', queryParams) {
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
    const postcodeSearch = matchPostcode(queryParams.q);
    if (queryParams.q && postcodeSearch) {
        let postcode = postcodeSearch[0];
        queryParams.q = queryParams.q.replace(postcode, '');
        queryParams.postcode = postcode;
    } else {
        delete queryParams.postcode;
    }

    const sort = determineSort(queryParams);
    const matchCriteria = await buildMatchCriteria(queryParams);

    const hasOnlyQuery = name =>
        Object.keys(queryParams).length === 1 && has(queryParams, name);

    /**
     * Construct the aggregation pipeline
     * Includes stripping 360Giving organisation prefix
     * from the public ID field.
     */
    const resultsPipeline = compact([
        { $match: matchCriteria },

        /**
         * Provide a hint to use a more efficient query for location searches
         * https://jira.mongodb.org/browse/SERVER-7568?focusedCommentId=814169&page=com.atlassian.jira.plugin.system.issuetabpanels%3Acomment-tabpanel#comment-814169
         * @TODO: Reduce the specificity of this
         */
        hasOnlyQuery('localAuthority') ||
        hasOnlyQuery('westminsterConstituency')
            ? { $project: { _id: 0 } }
            : null,

        { $sort: sort.criteria },

        {
            $addFields: {
                id: {
                    $arrayElemAt: [{ $split: ['$id', ID_PREFIX] }, 1]
                }
            }
        }
    ]);

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
     * Compute totals
     */
    const totalGrants = await mongo.grantsCollection.find({}).count();

    const getDate = getFp('[0].awardDate');
    const firstGrant = await mongo.grantsCollection
        .find({})
        .sort({
            awardDate: -1
        })
        .limit(1)
        .toArray();

    const lastGrant = await mongo.grantsCollection
        .find({})
        .sort({
            awardDate: 1
        })
        .limit(1)
        .toArray();

    const grantDates = {
        end: getDate(firstGrant),
        start: getDate(lastGrant)
    };

    const totalGrantsForQuery = await mongo.grantsCollection
        .find(matchCriteria)
        .count();

    const totalAwarded = await fetchTotalAwarded(
        mongo.grantsCollection,
        matchCriteria
    );

    /**
     * Perform query for grant results
     */
    let grantsResult = await mongo.grantsCollection
        .aggregate(resultsPipeline, { allowDiskUse: true })
        .skip(skipCount)
        .limit(perPageCount)
        .toArray();

    // Add any final fields we need before output
    grantsResult = grantsResult.map(grant => addGrantDetail(grant, locale));

    let facets;
    if (!queryParams.related) {
        const shouldUseCachedFacets = totalGrants === totalGrantsForQuery;
        if (shouldUseCachedFacets) {
            const cachedFacets = await mongo.facetsCollection
                .find()
                .limit(1)
                .sort({ $natural: -1 })
                .toArray();
            facets = get(head(cachedFacets), locale);
        } else {
            facets = await fetchFacets(
                mongo.grantsCollection,
                matchCriteria,
                locale,
                grantsResult
            );
        }
    }

    /**
     * Pluck out the current sort type from the sort criteria
     * to allow us to return the sort as a meta key.
     */
    return {
        meta: {
            totalResults: totalGrantsForQuery,
            totalAwarded: totalAwarded,
            grantDates: grantDates,
            query: queryParams,
            searchSuggestions: await getSearchSuggestions(
                locale,
                totalGrantsForQuery,
                queryParams
            ),
            sort: buildSortMeta(sort, queryParams),
            pagination: buildPagination(
                currentPage,
                perPageCount,
                skipCount,
                totalGrantsForQuery,
                queryParams
            )
        },
        facets: facets,
        results: grantsResult
    };
}

async function fetchGrantByRecipient(
    grantsCollection,
    recipientId,
    queryParams
) {
    const perPageCount =
        (queryParams.limit && parseInt(queryParams.limit)) || 50;
    const pageParam = queryParams.page && parseInt(queryParams.page);
    const currentPage = pageParam > 1 ? pageParam : 1;
    const skipCount = perPageCount * (currentPage - 1);
    const locale = queryParams.locale || 'en';

    const matchCriteria = await buildMatchCriteria({
        recipient: recipientId
    });

    /**
     * Construct the aggregation pipeline
     * Includes stripping 360Giving organisation prefix
     * from the public ID field.
     */
    const resultsPipeline = [
        { $match: matchCriteria },
        { $sort: { awardDate: -1, 'recipientOrganization.id': 1 } },
        {
            $addFields: {
                id: {
                    $arrayElemAt: [{ $split: ['$id', ID_PREFIX] }, 1]
                }
            }
        }
    ];

    let grantsResult = await grantsCollection
        .aggregate(resultsPipeline, { allowDiskUse: true })
        .skip(skipCount)
        .limit(perPageCount)
        .toArray();

    // Add any final fields we need before output
    grantsResult = grantsResult.map(grant => addGrantDetail(grant, locale));

    const facetsResult = await grantsCollection
        .aggregate([
            { $match: matchCriteria },
            {
                $facet: {
                    grantProgramme: [
                        {
                            $group: {
                                _id: '$grantProgramme.title',
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { _id: 1 } },
                        { $project: { count: 1, label: '$_id', value: '$_id' } }
                    ]
                }
            }
        ])
        .toArray();

    /**
     * Compute totals
     */
    const totalGrantsForQuery = await grantsCollection
        .find(matchCriteria)
        .count();

    const totalAwarded = await fetchTotalAwarded(
        grantsCollection,
        matchCriteria
    );

    return {
        meta: {
            totalResults: totalGrantsForQuery,
            totalAwarded: totalAwarded,
            pagination: buildPagination(
                currentPage,
                perPageCount,
                skipCount,
                totalGrantsForQuery,
                queryParams
            )
        },
        facets: head(facetsResult),
        results: grantsResult
    };
}

/**
 * Fetch grant by ID
 * Accepts an ID without the 360Giving prefix
 * We don't want to expose this in public urls
 * so we prepend this when doing lookups
 */
async function fetchGrantById(collection, id, locale = 'en') {
    const fullID = `${ID_PREFIX}${id}`;
    let result = await collection.findOne({ id: fullID });
    result = result && addGrantDetail(result, locale);
    return result;
}

module.exports = {
    fetchGrants,
    fetchGrantById,
    fetchGrantByRecipient,
    fetchFacets
};
