# Using Websockets with API-Gateway

API-Gateway provides developers with the ability to create websockets
endpoints for applications. Certain features, such as routing
based on payload data and lambda integration make it easy to build
your own apis and respond to different request types. The usage of
these feature will be demonstrated by implementing a server
that maintains connections to clients playing naught's and crosses's
against each other. Players will either start new games or connect to
existing games using the client script. Player moves are communicated
through API-Gateway via a websocket where lambda and dynamodb ensure
player interactions are communicated to the correction connections.

## Maintaining Player Connections

Each player will use a single connection to maintain communication.
The connection ids of the two players will be held in a single dynamo
item. The dynamo table has a time-to-live attribute of `ttl` which is
set after the first player connects.

```typescript
/**
 * A dynamodb table to hold game connection information.
 */
const connectionTable = new dynamodb.Table(this, "connectionTable", {
    partitionKey: {
    name: "GameId",
        type: dynamodb.AttributeType.STRING,
    },
    timeToLiveAttribute: "ttl",
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

## The Websocket API-Gateway

An API-gateway that handles websockets can be defined through the `aws_apigatewayv2.WebSocketApi` construct.

```typescript
const wsApiGw = new apigatewayv2.WebSocketApi(this, "wsApiGw", {
    routeSelectionExpression: "${request.body.type}",
});
```

The `routeSelectionExpression` allows incoming requests to be handled
by different routes defined on the API-Gateway. Specifically (assuming
the request is sent as JSON), `routeSelectionExpression` set as
`"${request.body.type}"` will send the request to the route corresponding
to the `"type"` attribute of the JSON request. Routes may be added via
the `addRoute` method.

```typescript
wsApiGw.addRoute("start", {
    integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
        "StartIntegration",
        startIntegrationLambda
    ),
});
```

The `aws_apigatewayv2_integrations.WebSocketLambdaIntegration` allows
requests to be handled by a target lambda. In this case, the
`startIntegrationLambda` will be used to handle request in which the
request `"type"` attribute is `"start"`. The request is provided to the
lambda handler through the event `"body"` attribute.

## How to Test

First clone the repository

```bash
git clone https://github.com/Michae1CC/aws-cdk-examples
```

and change directory into the `apigw-ws` folder.

```bash
cd apigw-ws
```

Run

```bash
npm install
```

to install the required packages to create our Cloudformation template and then

```bash
cdk bootstrap && cdk deploy
```

When deploying, there should be an output indicating the URL for the
websocket API-gateway

```text
Outputs:
ApigwWsStack.websocketEndpoint = wss://<endpoint-url>
```

Export this as follows for the client to use

```bash
export WEBSOCKET_URL='wss://<endpoint-url>'
```

In one terminal run

```bash
python src/client.py new
```

to start a new game. The script should indicate that a new game has
started by displaying a game-id.

```text
Connected to game: <game-id>
Waiting for opponent to connect /
```

In a second terminal, join the game in the first terminal by running

```bash
python src/client.py join --id <game-id>
```

Players will then be presented with a cli game of Naughts and Crosses
where player moves are communicated over a websocket backed by
API-Gateway.

```text
0,0            0,2              
       |   | o
    -----------
     x | o | x
    -----------
       |   |  
 2,0            2,2

Enter turn:        
```

Run the following to clean up any resources created in this tutorial

```bash
cdk destroy
```

## Resources

* <https://websockets.readthedocs.io/en/stable/intro/tutorial1.html>
* <https://bbc.github.io/cloudfit-public-docs/asyncio/asyncio-part-1>
* <https://developer.mozilla.org/en-US/docs/Web/API/WebSocket>
* <https://dev.to/aws-builders/your-complete-api-gateway-and-cors-guide-11jb>
* <https://docs.aws.amazon.com/apigateway/latest/developerguide/websocket-api-chat-app.html>
* <https://github.com/facebook/create-react-app>