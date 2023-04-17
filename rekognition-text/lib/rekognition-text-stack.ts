import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Table, BillingMode, AttributeType } from "aws-cdk-lib/aws-dynamodb";
import { Bucket, EventType, HttpMethods } from "aws-cdk-lib/aws-s3";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";
import * as path from "path";
import { RemovalPolicy } from "aws-cdk-lib";

export class RekognitionTextStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 core
    const bucket = new Bucket(this, "LICENSE_IMAGES");

    // DynamoDB Table
    const table = new Table(this, "LICENSE_RECORDS", {
      partitionKey: { name: "LicenseNo", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Policies to attach to our lambda
    const initialPolicy: Array<PolicyStatement> = [
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["rekognition:DetectText"],
        resources: ["*"],
      }),
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["rekognition:DetectLabels"],
        resources: ["*"],
      }),
    ];

    // lambda
    const lambda = new Function(this, "LICENSE_FUNCTION", {
      runtime: Runtime.PYTHON_3_9,
      code: Code.fromAsset(path.join(__dirname, "..", "src", "image_lambda")),
      handler: "lambda.handler",
      initialPolicy: initialPolicy,
      environment: {
        DYNAMODB_TABLE: table.tableName,
      },
    });

    // Grant our lambda read permissions for s3 and
    // write permissions for dynamo
    bucket.grantRead(lambda);
    table.grantWriteData(lambda);

    // Add an S3 event to the lambda
    lambda.addEventSource(
      new cdk.aws_lambda_event_sources.S3EventSource(bucket, {
        events: [EventType.OBJECT_CREATED],
      })
    );

    // Output
    new cdk.CfnOutput(this, "S3BucketName", {
      value: bucket.bucketName,
      description: "S3 Bucket Name",
      exportName: "S3BucketName",
    });
    new cdk.CfnOutput(this, "TableName", {
      value: table.tableName,
      description: "Table Name",
      exportName: "TableName",
    });
    new cdk.CfnOutput(this, "Lambda Name", {
      value: lambda.functionName,
      description: "Lambda Name",
      exportName: "LambdaName",
    });
  }
}
