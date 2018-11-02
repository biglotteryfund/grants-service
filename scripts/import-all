#!/usr/bin/env bash

INPUT_DIR=$1
DATABASE_NAME=$2
COLLECTION_NAME=$3

if [ -z "$1" ]
  then
    echo "First argument should be a path to a folder containing CSV files"
    exit 1
fi

if [ -z "$2" ]
  then
    echo "Second argument should be the database to use"
    exit 1
fi

if [ -z "$3" ]
  then
    echo "Third argument should be a collection name to import into"
    exit 1
fi

for file in $INPUT_DIR/*.csv
do
    ./scripts/import-csv "$file" "$DATABASE_NAME" "$COLLECTION_NAME"
done
