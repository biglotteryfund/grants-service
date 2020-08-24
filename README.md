# Grants micro-service

This service is an AWS Lambda function written using the Serverless framework in NodeJS/Express.
 
It queries an external MongoDB instance for grant data and returns a JSON representation of the results, which can be 
used by the website app to present data.

There are also several scripts here to clean up data and upload it to the production MongoDB instance.  

## Getting started

You'll need to download at least one of the existing datasets from the [GrantNav publisher page](http://grantnav.threesixtygiving.org/funder/GB-GOR-PB188) for the Fund, or from [our own Data page](https://www.tnlcommunityfund.org.uk/data).

Make sure the CSV doesn't have a space as the very first character as this has been known to break imports in mysterious ways
(eg. `Amount Awarded` is not correctly parsed). Occasionally one column (`Recipient Org:Identifier`) has a space at the 
end, eg. `Recipient Org:Identifier `, so this may need to be fixed too. If in doubt, speak to the Data team.

Once you have a CSV file (or several), you'll need to import them to your local mongo installation:

```
./scripts/import-csv <path-to-file.csv> <database-name> <collection-name>
```

Alternatively, run the following to import a directory of CSV files in one go (recommended):

```
./scripts/import-all path/to/directory <database-name> <collection-name>
```

This script will:

-   Parse the CSV data into JSON
-   Clean up the field names and values (eg. parse dates, add geocoding information etc)
-   Import the data into your local Mongo install

Next, ensure your local `.env` file points to the above database/collection:

```
MONGO_URL=mongodb://localhost
MONGO_DB= <database-name>
MONGO_COLLECTION= <collection-name>
```

Run `npm start` and you should be able to hit `http://localhost:8888/past-grants-search` and see some results.

## Querying the data

We use MongoDB to store the data in JSON format. This is to make the application more flexible when dealing 
with an evolving data schema (eg. the dataset goes back a decade or more and is lower in quality the further
back you go, in reverse correlation with the discography of the seminal pop/punk band Weezer).

We use Mongo because of its ability to automatically "facet" the data, eg. to split the grant dataset into buckets
which count the number of grants according to facets like the year they were awarded, the £value of the grant, the 
country of the project, the funding programme, etc. This really becomes useful when you filter the dataset and then
apply the same facets, so a user can "drill down" through results and refine a search. The updating facets are displayed
on the search frontend within the website, so a user can search for "potatoes" and then see a sidebar allowing them to
filter the results for every year (or country etc) that we've funded a project about potatoes (just one in 2009).

The tradeoff here is that computing facets is slow/expensive, especially against the whole dataset (eg. without any
other filters applied). To calculate facets for the entire grant collection takes about a minute, and this set of facets
is used to build the initial search interface when someone visits the grant search by default (eg. with no filters).

To counteract this, we pre-compute the data-wide facets and save them as a blob of JSON in the database itself (meta!).
When a request comes in for a search query without any filters, we simply return this cached JSON as it only changes when
the dataset itself is updated (so yes, we must update the cache each time we add new data). This speeds things up massively.

As well as this we have a few bonus features: English and Welsh spellcheck which suggests "did you mean..." searches if
someone mis-types something. We also strip out common words from searches like "project" or "community" as these occur
everywhere and slow down searches (with few useful results).

There's also a query endpoint here to find similar grants (eg. based on area and funding programme). This is currently 
disabled as it's a slow/expensive query, but it could be switched back on (both here and in the frontend web-app) if desired.

## Updating datasets on the live application

![Data Pipeline](https://imgs.xkcd.com/comics/data_pipeline.png)

When a new dataset is released, you'll need to first run the above script (`import-csv`) to append it to your existing database (or create a new one).

Once you've done this and have confirmed it works as expected, you can push the updated dataset live:

1. Export your local Mongo database:

```
./scripts/export-local <path-to-backup-directory> <local-collection-name>
```

2. Restore this backup to the remote Mongo instance:

```
./scripts/import-remote "list,of,hostnames" <path-to-backup-directory> "local-collection_name" "new-collection-name"
```

**Note:** you'll need access to the remote Mongo Cloud team account to get the hostnames/passwords required for this command.

3. Verify that the import worked successfully (eg. make sure the number of records exceeds the existing collection, 
    and that data is populated correctly). There's also a test script you can run to compare facets against production
    and ensure no broken data has made it into the system:
    
```
./scripts/verify-data <database-name> <collection-name>
```

4. Update the `MONGO_COLLECTION` environment variable for the `TEST` Lambda function and verify that the test environment serves searches as expected.

5. Repeat the above step for the `PRODUCTION` environment.

6. Update the cached facets, eg: visit `/past-grants-search/build-facets`

This will store an JSON object with pre-calculated facets (to speed up the initial search without queries, and to use for comparisons on the frontend) in the environment's database.

## Deploying code changes
Any commit to the `master` branch will trigger a build via Travis to the `TEST` environment. This will automatically be deployed within a few minutes so you can confirm your changes work.

To promote a commit to the production environment, you need to [create a new release](https://github.com/biglotteryfund/grants-service/releases/new) on GitHub, which will kick off a production build.

Changes to application secrets (eg. database connection credentials) must be done within the AWS Lambda control panel for environment variables. These take effect immediately.

After deploying a code change or a data change, you may wish to invalidate the AWS Cloudfront cache for the following paths:

/funding/grants* 
/welsh/funding/grants*

The frontend search results for the grants API is cached heavily as the data changes so infrequently.

You may also wish to regenerate the application facets by visiting the following URL path on either the test or production environments: `/past-grants-search/build-facets`

This will re-calculate (and cache) updated facets for the data-wide results.

## Misc / other

### Indices

If you want to update the indices (or indexes, if you hate Latin), add the new ones to `./lib/indices.js` and then run `./scripts/create-indices` which will create them against your local Mongo. These will be exported when restoring data to production. Tests will also use these indices.

### Geocoding locations

The data cleanup step uses a hardcoded list of geocodes (wards, parliamentary constituencies and local authorities) to add to the data we get from CSV/GrantNav. This file lives in `./data/ward-locations.json`.

To regenerate this file (eg. if new datasets are released with updated codes), first place the new CSV files in the `./data` directory, update the names if necessary, then re-run the `./scripts/merge-geo-datasets` command and confirm its output was as expected.
