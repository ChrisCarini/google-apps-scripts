#!/usr/bin/env bash

export NODE_MODULES=./node_modules
export NODE_PACKAGE_JSON=./package.json
export CLASP_RC=~/.clasprc.json
export CLASP_BIN=./node_modules/.bin/clasp

# Check if this directory has a `node_modules` directory; if not, try to run `npm install`
if [[ -f "$NODE_PACKAGE_JSON" ]]; then
  if [[ ! -d "$NODE_MODULES" ]]; then
    echo -e "$NODE_MODULES does not exist...\nRunning 'npm install'..."
    npm install
  else
    echo "$NODE_PACKAGE_JSON does not exist. Proceeding..."
  fi
else
  echo "$NODE_PACKAGE_JSON does not exist. Proceeding..."
fi

# Check if the `clasp` binary exists - this script is pointless without it.
if [[ ! -f $CLASP_BIN ]]; then
  echo "$CLASP_BIN does not exist. Exiting."
  exit 1
fi

# Check if we've already authenticated to Google for `clasp` usage.
if [[ ! -f $CLASP_RC ]]; then
  echo -e "$CLASP_RC does not exist...\nRunning 'clasp login'..."
#  $CLASP_BIN login
fi

$CLASP_BIN pull

# ./node_modules/.bin/clasp push --watch --force
$CLASP_BIN push --watch --force
