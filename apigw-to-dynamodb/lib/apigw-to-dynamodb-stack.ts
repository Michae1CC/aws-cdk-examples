import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { RemovalPolicy } from "aws-cdk-lib";
import { Cors, PassthroughBehavior } from "aws-cdk-lib/aws-apigateway";
import { Table, BillingMode } from "aws-cdk-lib/aws-dynamodb";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from "constructs";

export class ApigwToDynamodbStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const projectName = "ice-cream-flavours";

    /**
     * Create a Dynamo Table
     * Streaming is enabled to send new objects down the pipeline
     */
    const dynamoTable = new Table(this, projectName, {
      partitionKey: {
        name: "flavour",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      // When the resouce is removed, it will be destoryed
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: projectName,
      // Only send images of the record post modification
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    /**
     * Lambda dynamo stream subscriber
     */
    const dynamoStreamSubscriberLambda = new lambda.Function(
      this,
      "dynamoStreamHandler",
      {
        // Runtime environment
        runtime: lambda.Runtime.NODEJS_18_X,
        code: lambda.Code.fromAsset("lambda/subscribe"),
        // file is "lambda", function is "handler"
        handler: "lambda.handler",
        environment: {},
      }
    );

    // Subscribe of lambda to the event stream
    dynamoStreamSubscriberLambda.addEventSource(
      new DynamoEventSource(dynamoTable, {
        startingPosition: lambda.StartingPosition.LATEST,
      })
    );

    /**
     * API Gateway creation
     */
    let restApi = new cdk.aws_apigateway.RestApi(this, "DynamoStreamerAPI", {
      deployOptions: {
        metricsEnabled: true,
        loggingLevel: cdk.aws_apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        stageName: "prod",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
      },
      restApiName: projectName,
    });

    // Provide our gateway with permissions to access our dynamodb table
    const apigwDynamodbRole = new iam.Role(this, "DefaultLambdaHandlerRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
    });
    dynamoTable.grantReadWriteData(apigwDynamodbRole);

    // Create our response model
    const responseModel = restApi.addModel("ResponseModel", {
      contentType: "application/json",
      modelName: "ResponseModel",
      schema: {
        schema: cdk.aws_apigateway.JsonSchemaVersion.DRAFT4,
        title: "pollResponse",
        type: cdk.aws_apigateway.JsonSchemaType.OBJECT,
        properties: {
          message: { type: cdk.aws_apigateway.JsonSchemaType.STRING },
        },
      },
    });

    // Define a schema for the transformed error responses
    const errorResponseModel = restApi.addModel("ErrorResponseModel", {
      contentType: "application/json",
      modelName: "ErrorResponseModel",
      schema: {
        schema: cdk.aws_apigateway.JsonSchemaVersion.DRAFT4,
        title: "errorResponse",
        type: cdk.aws_apigateway.JsonSchemaType.OBJECT,
        properties: {
          state: {
            type: cdk.aws_apigateway.JsonSchemaType.STRING,
          },
          message: {
            type: cdk.aws_apigateway.JsonSchemaType.STRING,
          },
        },
      },
    });

    const errorResponses = [
      {
        // For errors, we check if the response contains the words BadRequest
        selectionPattern: "^[BadRequest].*",
        statusCode: "400",
        responseTemplates: {
          "application/json": JSON.stringify({
            state: "error",
            message: "$util.escapeJavaScript($input.path('$.errorMessage'))",
          }),
        },
      },
      {
        // Create a generic response for an internal service error
        selectionPattern: "5\\d{2}",
        statusCode: "500",
        responseTemplates: {
          "application/json": `{
            "error": "Internal Service Error!"
          }`,
        },
      },
    ];

    const allResources = restApi.root.addResource(projectName);
    const singleResource = allResources.addResource("{flavour}");

    const createIntegration = new cdk.aws_apigateway.AwsIntegration({
      // Native aws integration
      service: "dynamodb",
      action: "PutItem",
      options: {
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: apigwDynamodbRole,
        requestTemplates: {
          "application/json": JSON.stringify({
            TableName: dynamoTable.tableName,
            Item: {
              flavour: { S: "$input.path('$.flavour')" },
              cost: { S: "$input.path('$.cost')" },
            },
          }),
        },
        integrationResponses: [
          {
            // Tells APIGW which response to use based on the returned code from the service
            statusCode: "200",
            responseTemplates: {
              // Just respond with a generic message
              // Check https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
              "application/json": JSON.stringify({
                message: "Added flavour to table",
              }),
            },
          },
          ...errorResponses,
        ],
      },
    });

    const getIntegration = new cdk.aws_apigateway.AwsIntegration({
      // Native aws integration
      service: "dynamodb",
      action: "GetItem",
      options: {
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: apigwDynamodbRole,
        requestTemplates: {
          "application/json": JSON.stringify({
            TableName: dynamoTable.tableName,
            Key: {
              flavour: { S: "$method.request.path.flavour" },
            },
          }),
        },
        integrationResponses: [
          {
            statusCode: "200",
          },
          ...errorResponses,
        ],
      },
    });

    const deleteIntegration = new cdk.aws_apigateway.AwsIntegration({
      // Native aws integration
      service: "dynamodb",
      action: "DeleteItem",
      options: {
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: apigwDynamodbRole,
        requestTemplates: {
          "application/json": JSON.stringify({
            TableName: dynamoTable.tableName,
            Key: {
              flavour: { S: "$method.request.path.flavour" },
            },
          }),
        },
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              // Just respond with a generic message
              // Check https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
              "application/json": JSON.stringify({
                message: "Removed flavour from table",
              }),
            },
          },
          ...errorResponses,
        ],
      },
    });

    const methodOptions = {
      methodResponses: [
        {
          statusCode: "200",
          responseModels: {
            "application/json": responseModel,
          },
        },
        {
          statusCode: "400",
          responseModels: {
            "application/json": errorResponseModel,
          },
        },
        {
          statusCode: "500",
          responseModels: {
            "application/json": errorResponseModel,
          },
        },
      ],
    };

    // Create an endpoint to insert data into the tabel
    allResources.addMethod("POST", createIntegration, methodOptions);

    singleResource.addMethod("GET", getIntegration, methodOptions);
    singleResource.addMethod("DELETE", deleteIntegration, methodOptions);
  }
}
