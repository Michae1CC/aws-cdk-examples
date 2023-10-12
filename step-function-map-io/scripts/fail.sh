#!/bin/bash

set -euox pipefail

# Check that the url has been provided
if [[ "$#" -ne 1 ]]; then
    echo "Expected endpoint url"
    exit 1
fi

BASE_URL='https://www.fluentpython.com/data/flags';
# The resource path zz does not exist!
RESOURCE_PATHS='"cn/cn.gif","in/in.gif","us/us.gif","mx/mx.gif", "zz/zz.gif"'

curl -i --globoff -X POST \
   -H "Content-Type:application/json;chartset=UTF-8" \
   -d \
    "{ \"resourcePaths\": [$RESOURCE_PATHS], \"baseUrl\": \"$BASE_URL\", \"lambdaConcur\": 2 }" \
    "$1"