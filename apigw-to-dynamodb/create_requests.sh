#!/bin/bash

curl -i -X POST \
   -H "Content-Type:application/json" \
   -d \
'{"flavour": "Pistachio", "cost": "2.00"}' \
 'https://wiw2vvtvk1.execute-api.us-east-1.amazonaws.com/prod/ice-cream-flavours'

# curl -i -X GET \
#  'https://wiw2vvtvk1.execute-api.us-east-1.amazonaws.com/prod/ice-cream-flavours/Vanilla2'

# curl -i -X DELETE \
#  'https://wiw2vvtvk1.execute-api.us-east-1.amazonaws.com/prod/ice-cream-flavours/Vanilla8'

