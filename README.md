# Grants micro-service

This service is a lambda function which queries an external MongoDB instance for grant data.

## Getting started

You'll need to download at least one of the existing datasets from the [GrantNav publisher page](http://grantnav.threesixtygiving.org/publisher/360G-blf) for the Fund.

Once you have a CSV file, you'll need to import it to your local mongo installation:

`./scripts/import-csv <path-to-file.csv> <database-name> <collection-name>`

This script will:

-   Parse the CSV data into JSON
-   Clean up the field names and values (eg. parse dates, add geocoding information etc)
-   Import the data into your local Mongo install

Next, ensure your local `.env` file points to the above database/collection:

    MONGO_URL=mongodb://localhost
    MONGO_DB=blf
    MONGO_COLLECTION=grants

Run `npm start` and you should be able to hit `http://localhost:8888/past-grants-search` and see some results.

## Updating datasets

When a new dataset is released, you'll need to first run the above script (`import-csv`) to append it to your existing database (or create a new one).

Once you've done this and have confirmed it works as expected, you can push the updated dataset live:

1. Export your local Mongo database:

    `./scripts/export-local <path-to-backup-directory> <name-of-local-collection>`

2. Restore this backup to the remote Mongo instance:

    `./scripts/import-remote "list,of,hostnames" <path-to-backup-directory> "local-collection_name" "new-collection-name"`

    Note: you'll need access to the remote Mongo Cloud team account to get the hostnames/passwords required for this command.

3. Verify that the import worked successfully (eg. make sure the number of records exceeds the existing collection, and that data is populated correctly)

4. Update the `MONGO_COLLECTION` environment variable for the `TEST` Lambda function and verify that the test environment serves searches as expected.

5. Repeat the above step for the `PRODUCTION` environment.

6. Update the cached facets, eg:

    `./scripts/store-facets`

    This will generate an updated JSON file with pre-calculated facets (to speed up the initial search without queries, and to use for comparisons on the frontend). You should commit this file.

## Misc / other

### Indices

If you want to update the indices (or indexes, if you hate Latin), add the new ones to `./lib/indices.js` and then run `./scripts/create-indices` which will create them against your local Mongo. These will be exported when restoring data to production. Tests will also use these indices.

### Geocoding locations

The data cleanup step uses a hardcoded list of geocodes (wards, parliamentary constituencies and local authorities) to add to the data we get from CSV/GrantNav. This file lives in `./data/ward-locations.json`.

To regenerate this file (eg. if new datasets are released with updated codes), first place the new CSV files in the `./data` directory, update the names if necessary, then re-run the `./scripts/merge-geo-datasets` command and confirm its output was as expected.
