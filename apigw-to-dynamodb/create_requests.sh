#!/bin/bash

# curl -i -X POST \
#    -H "Content-Type:application/json" \
#    -d \
# '{"flavour": "Pistachio", "cost": "2.00"}' \
#  'https://d3ibnho8gc.execute-api.us-east-1.amazonaws.com/prod/ice-cream-flavours'

# curl -i -X GET \
#  'https://d3ibnho8gc.execute-api.us-east-1.amazonaws.com/prod/ice-cream-flavours/Pistachio'

curl -i -X DELETE \
 'https://d3ibnho8gc.execute-api.us-east-1.amazonaws.com/prod/ice-cream-flavours/Pistachio'

