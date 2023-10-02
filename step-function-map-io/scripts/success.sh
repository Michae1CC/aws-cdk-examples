#!/bin/bash

set -euox pipefail

# Check that the url has been provided
if [[ "$#" -ne 1 ]]; then
    echo "Expected endpoint url"
    exit 1
fi

BASE_URL='https://www.fluentpython.com/data/flags';
COUNTRY_CODES='cn in us id br pk ng bd ru jp mx ph vn et eg de ir tr cd fr';
RESOURCE_PATHS=$(echo "$COUNTRY_CODES" | xargs -n1 -I{} echo '"{}/{}.gif"' | tr '\n' ',' | sed 's/.$//')

curl -i --globoff -X POST \
   -H "Content-Type:application/json;chartset=UTF-8" \
   -d \
    "{ \"ResourcePaths\": [$RESOURCE_PATHS], \"BaseUrl\": \"$BASE_URL\", \"LambdaConcur\": 2 }" \
    "$1"