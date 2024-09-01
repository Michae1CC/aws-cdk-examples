import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  aws_apigatewayv2 as apigatewayv2,
  aws_apigatewayv2_integrations as apigatewayv2_integrations,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_iam as iam,
} from "aws-cdk-lib";
import { join } from "path";
import { Effect } from "aws-cdk-lib/aws-iam";

export class ApigwWsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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

    const wsApiGw = new apigatewayv2.WebSocketApi(this, "wsApiGw", {
      routeSelectionExpression: "${request.body.type}",
    });
    const wsApiGwStage = new apigatewayv2.WebSocketStage(this, "wsApiGwProd", {
      webSocketApi: wsApiGw,
      stageName: "prod",
      autoDeploy: true,
    });

    /**
     * An IAM policy to admit resources to perform operations on the
     * connection table.
     */
    const dynamoLambdaPolicy = new iam.PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["dynamodb:*"],
      resources: [connectionTable.tableArn],
    });

    const apigwLambdaPolicy = new iam.PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["execute-api:ManageConnections", "execute-api:Invoke"],
      resources: [wsApiGw.arnForExecuteApi(undefined, undefined, "prod")],
    });

    const websocketEndpoint = `${wsApiGw.apiEndpoint}/${wsApiGwStage.stageName}`;

    /**
     * A lambda to handle connections signalling the start of a new game.
     */
    const startIntegrationLambda = new lambda.Function(
      this,
      "startIntegrationLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        code: lambda.Code.fromAsset(join(__dirname, "..", "src", "lambda")),
        handler: "start.handler",
        environment: {
          CONNECTION_TABLE_NAME: connectionTable.tableName,
          WEBSOCKET_URL: websocketEndpoint,
        },
      }
    );
    startIntegrationLambda.addToRolePolicy(dynamoLambdaPolicy);
    startIntegrationLambda.addToRolePolicy(apigwLambdaPolicy);

    /**
     * A lambda to handle connections signalling that a second player is
     * wanting to join a game.
     */
    const joinIntegrationLambda = new lambda.Function(
      this,
      "joinIntegrationLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        code: lambda.Code.fromAsset(join(__dirname, "..", "src", "lambda")),
        handler: "join.handler",
        environment: {
          CONNECTION_TABLE_NAME: connectionTable.tableName,
          WEBSOCKET_URL: websocketEndpoint,
        },
      }
    );
    joinIntegrationLambda.addToRolePolicy(dynamoLambdaPolicy);
    joinIntegrationLambda.addToRolePolicy(apigwLambdaPolicy);

    /**
     * A lambda to handle connections signalling a play has been made by
     * a player.
     */
    const playIntegrationLambda = new lambda.Function(
      this,
      "playIntegrationLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        code: lambda.Code.fromAsset(join(__dirname, "..", "src", "lambda")),
        handler: "play.handler",
        environment: {
          CONNECTION_TABLE_NAME: connectionTable.tableName,
          WEBSOCKET_URL: websocketEndpoint,
        },
      }
    );
    playIntegrationLambda.addToRolePolicy(dynamoLambdaPolicy);
    playIntegrationLambda.addToRolePolicy(apigwLambdaPolicy);

    wsApiGw.addRoute("start", {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
        "StartIntegration",
        startIntegrationLambda
      ),
    });
    0;
    wsApiGw.addRoute("join", {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
        "JoinIntegration",
        joinIntegrationLambda
      ),
    });
    wsApiGw.addRoute("play", {
      integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
        "PlayIntegration",
        playIntegrationLambda
      ),
    });

    new cdk.CfnOutput(this, "websocketEndpoint", {
      value: websocketEndpoint,
    });
  }
}
