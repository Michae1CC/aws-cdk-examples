import * as cdk from "aws-cdk-lib";
import * as apigwv2alpha from "@aws-cdk/aws-apigatewayv2-alpha";
import {
  aws_apigatewayv2 as apigwv2,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_kms as kms,
  aws_s3 as s3,
  aws_sns as sns,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { join } from "path";

export class StepFunctionMapIoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Global environment variables

    // Defines the maximum number of lambdas we would like concurrently
    // executing
    const maxLambdaConcurrency = 5 as const;

    // Images bucket
    const imagesBucket = new s3.Bucket(this, "imagesBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: cdk.Duration.days(1),
            },
          ],
        },
      ],
    });

    // Url to s3 name dynamo table
    const urlToNameTable = new dynamodb.Table(this, "urlToName", {
      partitionKey: { name: "url", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Kms Key for Sns topic
    const kmsKey = new kms.Key(this, "SnsKmsKey", {
      description: "KMS key used for SNS",
      enableKeyRotation: true,
      enabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create an sns topic to alert users of errored requests
    const snsTopic = new sns.Topic(this, "SnsTopic", {
      masterKey: kmsKey,
    });

    // Batch Lambda
    const batchLambda = new lambda.Function(this, "batchLambda", {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset(
        join(__dirname, "..", "lambdas", "batch-lambda")
      ),
      handler: "batch_lambda.handler",
      environment: {
        MAX_CONCURENCY: `${maxLambdaConcurrency}`,
      },
    });

    const batchLambdaTask = new tasks.LambdaInvoke(this, "batchLambdaTask", {
      lambdaFunction: batchLambda,
      // Use the entire input
      inputPath: "$",
      payloadResponseOnly: true,
      taskTimeout: sfn.Timeout.duration(cdk.Duration.seconds(3)),
    });

    // Download lambda
    const itemIterator = new sfn.Map(this, "resourceIterator", {
      maxConcurrency: maxLambdaConcurrency,
      itemsPath: "$.Tasks",
      // Flatten the results from above into a single list
      resultSelector: {
        "results.$": "$[*][*]",
      },
    });

    const downloadLambda = new lambda.Function(this, "downloadLambda", {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset(
        join(__dirname, "..", "lambdas", "download-lambda"),
        {
          bundling: {
            image: lambda.Runtime.PYTHON_3_11.bundlingImage,
            command: [
              "bash",
              "-c",
              "set -euxo pipefail; pip install -r requirements.in -t /asset-output && cp -au . /asset-output",
            ],
          },
        }
      ),
      handler: "download_lambda.handler",
      environment: {
        IMAGES_BUCKET_NAME: imagesBucket.bucketName,
      },
    });

    // Allows us to save downloaded images to s3
    imagesBucket.grantWrite(downloadLambda);

    const downloadLambdaTask = new tasks.LambdaInvoke(
      this,
      "downloadLambdaTask",
      {
        lambdaFunction: downloadLambda,
        // Use the entire input
        inputPath: "$",
        // Replace the entire task output with the result
        resultPath: "$",
        // Ignore any lambda invocation metadata
        payloadResponseOnly: true,
        taskTimeout: sfn.Timeout.duration(cdk.Duration.seconds(120)),
      }
    );

    // Consolidate Lambda
    const consolidateLambda = new lambda.Function(this, "consolidateLambda", {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset(
        join(__dirname, "..", "lambdas", "consolidate-lambda")
      ),
      handler: "consolidate_lambda.handler",
    });

    const consolidateLambdaTask = new tasks.LambdaInvoke(
      this,
      "consolidateLambdaTask",
      {
        lambdaFunction: consolidateLambda,
        // Use the entire input
        inputPath: "$.results[*].statusCode",
        // Augment the result path with the all succeeded value
        resultPath: "$.allSucceeded",
        payloadResponseOnly: true,
        taskTimeout: sfn.Timeout.duration(cdk.Duration.seconds(2)),
      }
    );

    const publishErroredTasks = new tasks.SnsPublish(
      this,
      "publishErroredTasks",
      {
        topic: snsTopic,
        subject: "Failed stepfunction download tasks",
        inputPath: "$.results[?(@.statusCode != 200)].message",
        // Find all the tasks that did not have a status code of 200 and
        // extract the message component
        message: sfn.TaskInput.fromJsonPathAt("$"),
        resultPath: sfn.JsonPath.DISCARD,
      }
    );

    const publishErroredTasksAndFail = sfn.Chain.start(
      publishErroredTasks
    ).next(
      new sfn.Fail(this, "All resource downloads did not succeed", {
        cause: "One or more resources failed to download",
      })
    );

    const dynamoPutIterator = new sfn.Map(this, "dynamoPutIterator", {
      maxConcurrency: maxLambdaConcurrency,
      itemsPath: "$",
      inputPath: "$.results[?(@.statusCode == 200)]",
      resultPath: sfn.JsonPath.DISCARD,
    });

    const commitSucceededToDynamoTask = new tasks.DynamoPutItem(
      this,
      "commitSucceededTasks",
      {
        table: urlToNameTable,
        item: {
          url: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.url")
          ),
          filename: tasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt("$.filename")
          ),
        },
      }
    );

    // Define the statemachine
    const stateMachineDefinition = sfn.Chain.start(batchLambdaTask)
      .next(itemIterator.iterator(downloadLambdaTask))
      .next(consolidateLambdaTask)
      .next(dynamoPutIterator.iterator(commitSucceededToDynamoTask))
      .next(
        new sfn.Choice(this, "Check for errored tasks")
          .when(
            sfn.Condition.booleanEquals("$.allSucceeded", false),
            publishErroredTasksAndFail
          )
          .otherwise(new sfn.Pass(this, "All resource downloads succeeded"))
      );

    const mapStateMachineDefinition = new sfn.StateMachine(
      this,
      "DownloadImagesConcurrently",
      {
        definitionBody: sfn.DefinitionBody.fromChainable(
          stateMachineDefinition
        ),
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    mapStateMachineDefinition.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:Encrypt",
          "kms:GenerateDataKey*",
        ],
        resources: [`${kmsKey.keyArn}`],
      })
    );

    // Create a HTTP API endpoint to invoke our step function
    // To start we will need to give the endpoint permission to
    // invoke our function
    const httpApiRole = new iam.Role(this, "HttpApiRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      inlinePolicies: {
        AllowSFNExec: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["states:StartExecution"],
              effect: iam.Effect.ALLOW,
              resources: [mapStateMachineDefinition.stateMachineArn],
            }),
          ],
        }),
      },
    });
    const api = new apigwv2alpha.HttpApi(this, "StateMachineApi", {
      createDefaultStage: true,
    });

    // create an AWS_PROXY integration between the HTTP API and our Step Function
    const integ = new apigwv2.CfnIntegration(this, "Integ", {
      apiId: api.httpApiId,
      integrationType: "AWS_PROXY",
      connectionType: "INTERNET",
      integrationSubtype: "StepFunctions-StartExecution",
      credentialsArn: httpApiRole.roleArn,
      requestParameters: {
        Input: "$request.body",
        StateMachineArn: mapStateMachineDefinition.stateMachineArn,
      },
      payloadFormatVersion: "1.0",
      timeoutInMillis: cdk.Duration.minutes(2).toMilliseconds(),
    });

    new apigwv2.CfnRoute(this, "DefaultRoute", {
      apiId: api.httpApiId,
      routeKey: apigwv2alpha.HttpRouteKey.DEFAULT.key,
      target: `integrations/${integ.ref}`,
    });

    // output the URL of the HTTP API
    new cdk.CfnOutput(this, "Http Api Url", {
      value: api.url ?? "Something went wrong with the deploy",
    });
  }
}
