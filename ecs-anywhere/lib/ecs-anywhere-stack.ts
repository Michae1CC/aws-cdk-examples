import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  aws_dynamodb as dynamodb,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_iam as iam,
  aws_logs as logs,
  aws_sqs as sqs,
} from "aws-cdk-lib";
import { join } from "path";

export class EcsAnywhereStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Create a sqs queue for items to processes, once the items are processed
     * their ids will appear in the dynamo table.
     */
    const sqsQueue = new sqs.Queue(this, "queue");

    /**
     * Create a dynamo table to hold the ids of processed items
     */
    const dynamodbTable = new dynamodb.Table(this, "dynamodbTable", {
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /**
     * Create a vpc for our ecs service.
     */
    const vpc = new ec2.Vpc(this, "EcsAnywhereVPC", {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    /**
     * Create an ecs cluster for our service
     */
    const cluster = new ecs.Cluster(this, "EcsAnywhereCluster", {
      vpc: vpc,
      clusterName: "ecsAnywhereCluster",
    });

    /**
     * Create a task definition to run our processing service
     */
    const taskDefinition = new ecs.ExternalTaskDefinition(
      this,
      "externalTaskDefinition",
      {
        networkMode: ecs.NetworkMode.BRIDGE,
      }
    );

    // Allow the service to make updates to dynamo
    const modifyTablePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["dynamodb:*"],
      resources: [dynamodbTable.tableArn],
    });

    taskDefinition.addToTaskRolePolicy(modifyTablePolicy);

    // Allow the service to get, receive and delete messages from SQS
    const allowSqsOperations = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "sqs:GetQueueAttributes",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:DeleteMessageBatch",
      ],
      resources: [sqsQueue.queueArn],
    });

    taskDefinition.addToTaskRolePolicy(allowSqsOperations);

    const allowCloudwatchActionsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["cloudwatch:*"],
      resources: ["*"],
    });

    // To send container logs to CloudWatch Logs, make sure that you
    // create and specify a task execution IAM role in your task definition.
    // see: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-anywhere.html
    taskDefinition.addToExecutionRolePolicy(allowCloudwatchActionsPolicy);

    const serviceLogGroup = new logs.LogGroup(
      this,
      "iconResizeServiceLogGroup",
      {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: logs.RetentionDays.FIVE_DAYS,
      }
    );

    taskDefinition.addContainer("pasteContainer", {
      image: ecs.ContainerImage.fromAsset(join(__dirname, "..", "backend")),
      cpu: 256,
      memoryLimitMiB: 512,
      environment: {
        SQS_URL: sqsQueue.queueUrl,
        DYNAMO_TABLE_NAME: dynamodbTable.tableName,
        REGION: this.region,
      },
      essential: true,
      logging: new ecs.AwsLogDriver({
        streamPrefix: "pasteApp",
        logGroup: serviceLogGroup,
      }),
    });

    const externalServiceSecurityGroup = new ec2.SecurityGroup(
      this,
      "externalServiceSecurityGroup ",
      {
        vpc: vpc,
        allowAllOutbound: true,
      }
    );

    new ecs.ExternalService(this, "ExternalService", {
      serviceName: "pasteService",
      cluster: cluster,
      taskDefinition,
      desiredCount: 1,
      securityGroups: [externalServiceSecurityGroup],
    });

    new cdk.CfnOutput(this, "sqsQueueUrl", {
      value: sqsQueue.queueUrl,
    });

    new cdk.CfnOutput(this, "tableName", {
      value: dynamodbTable.tableName,
    });
  }
}
