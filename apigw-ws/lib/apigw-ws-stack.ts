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

    const connectionTable = new dynamodb.Table(this, "connectionTable", {
      partitionKey: {
        name: "GameId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const dynamoLambdaPolicy = new iam.PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["dynamodb:*"],
      resources: [connectionTable.tableArn],
    });

    const apigwLambdaPolicy = new iam.PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["execute-api:ManageConnections", "execute-api:Invoke"],
      resources: ["*"],
    });

    const startIntegrationLambda = new lambda.Function(
      this,
      "startIntegrationLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        code: lambda.Code.fromAsset(join(__dirname, "..", "src", "lambda")),
        handler: "start.handler",
        environment: {
          CONNECTION_TABLE_NAME: connectionTable.tableName,
        },
      }
    );
    startIntegrationLambda.addToRolePolicy(dynamoLambdaPolicy);
    startIntegrationLambda.addToRolePolicy(apigwLambdaPolicy);

    const joinIntegrationLambda = new lambda.Function(
      this,
      "joinIntegrationLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        code: lambda.Code.fromAsset(join(__dirname, "..", "src", "lambda")),
        handler: "join.handler",
        environment: {
          CONNECTION_TABLE_NAME: connectionTable.tableName,
        },
      }
    );
    joinIntegrationLambda.addToRolePolicy(dynamoLambdaPolicy);
    joinIntegrationLambda.addToRolePolicy(apigwLambdaPolicy);

    const wsApiGw = new apigatewayv2.WebSocketApi(this, "wsApiGw", {
      routeSelectionExpression: "${request.body.type}",
    });
    new apigatewayv2.WebSocketStage(this, "wsApiGwProd", {
      webSocketApi: wsApiGw,
      stageName: "prod",
      autoDeploy: true,
    });

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
  }
}
