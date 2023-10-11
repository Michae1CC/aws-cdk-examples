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

    /**
     * Global resources and parameters
     */

    // Defines the maximum number of lambdas we would like concurrently
    // executing
    const maxLambdaConcurrency = 5 as const;

    // An s3 bucket to place our images into
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

    /**
     * Step function tasks and resources
     */

    // A lambda to batch the image download tasks
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

    // Create a stepfunction task for the batch lambda
    const batchLambdaTask = new tasks.LambdaInvoke(this, "batchLambdaTask", {
      lambdaFunction: batchLambda,
      // Use the entire input from the step function invocation
      inputPath: "$",
      // Don't attach any additional metadata in the payload response
      payloadResponseOnly: true,
      taskTimeout: sfn.Timeout.duration(cdk.Duration.seconds(5)),
    });

    // Create a lambda to download images using the base url and resource
    // paths
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

    // Create a stepfunction task for the download lambda
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

    // This map iterator will start a pool of lambda tasks each with a
    // single item from resultSelector
    const itemIterator = new sfn.Map(this, "resourceIterator", {
      maxConcurrency: maxLambdaConcurrency,
      itemsPath: "$.tasks",
      // Flatten the results from above into a single list
      resultSelector: {
        "results.$": "$[*][*]",
      },
    });

    // This lambda will just check if all the downloads from the previous steps
    // finished successfully
    const consolidateLambda = new lambda.Function(this, "consolidateLambda", {
      runtime: lambda.Runtime.PYTHON_3_11,
      code: lambda.Code.fromAsset(
        join(__dirname, "..", "lambdas", "consolidate-lambda")
      ),
      handler: "consolidate_lambda.handler",
    });

    // Create a stepfunction task for our consolidation step
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

    // Create a stepfunction iterator to iterate over the successfully
    // downloaded and create url-s3 name entries in dynamodb
    const dynamoPutIterator = new sfn.Map(this, "dynamoPutIterator", {
      maxConcurrency: maxLambdaConcurrency,
      itemsPath: "$",
      // We only want to create entries for resources that downloaded
      // successfully, that is, downloaded with a status code of 200
      inputPath: "$.results[?(@.statusCode == 200)]",
      // Just forward the input for the iterator to the next step
      resultPath: sfn.JsonPath.DISCARD,
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

    // Create a stepfunction task to publish unsuccessful downloads to the
    // above sns topic
    const publishErroredTasks = new tasks.SnsPublish(
      this,
      "publishErroredTasks",
      {
        topic: snsTopic,
        subject: "Failed stepfunction download tasks",
        // Find all the tasks that did not have a status code of 200 and
        // extract the message component
        inputPath: "$.results[?(@.statusCode != 200)].message",
        message: sfn.TaskInput.fromJsonPathAt("$"),
        resultPath: sfn.JsonPath.DISCARD,
      }
    );

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

    /**
     * State machine definition and api gateway integration
     */

    // After publishing errored task, fail the stepfunction invocation.
    const publishErroredTasksAndFail = sfn.Chain.start(
      publishErroredTasks
    ).next(
      new sfn.Fail(this, "All resource downloads did not succeed", {
        cause: "One or more resources failed to download",
      })
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

    // Provide the state machine access to kms key for our sns topic
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

    // Create an AWS_PROXY integration between the HTTP API and our Step Function
    const stepFunctionIntegration = new apigwv2.CfnIntegration(
      this,
      "stepFunctionIntegration",
      {
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
        timeoutInMillis: cdk.Duration.seconds(10).toMilliseconds(),
      }
    );

    // Have the api gateway default route target our stepfunction integration
    new apigwv2.CfnRoute(this, "DefaultRoute", {
      apiId: api.httpApiId,
      routeKey: apigwv2alpha.HttpRouteKey.DEFAULT.key,
      target: `integrations/${stepFunctionIntegration.ref}`,
    });

    // Output the URL of the HTTP API
    new cdk.CfnOutput(this, "Http Api Url", {
      value: api.url ?? "Something went wrong with the deploy",
    });
  }
}
