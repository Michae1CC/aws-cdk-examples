#!/bin/bash

set -euox pipefail

# Check that the url has been provided
if [[ "$#" -ne 1 ]]; then
    echo "Expected endpoint url"
    exit 1
fi

BASE_URL='https://www.fluentpython.com/data/flags';
COUNTRY_CODES='ad ae af ag al am ao ar at au az ba bb bd be bf bg bh bi bj bn bo br bs bt bw by bz ca cd cf cg ch ci cl cm cn co cr cu cv cz de dj dk dm dz ec ee eg es et fi fm fr ga gd ge gh gm gn gq ht ht hu id ie il in iq ir is it jm jo jp ke kh ki km kp kr kw kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml';
RESOURCE_PATHS=$(echo "$COUNTRY_CODES" | xargs -n1 -I{} echo '"{}/{}.gif"' | tr '\n' ',' | sed 's/.$//')

curl -i --globoff -X POST \
   -H "Content-Type:application/json;chartset=UTF-8" \
   -d \
    "{ \"resourcePaths\": [$RESOURCE_PATHS], \"baseUrl\": \"$BASE_URL\", \"lambdaConcur\": 5 }" \
    "$1"