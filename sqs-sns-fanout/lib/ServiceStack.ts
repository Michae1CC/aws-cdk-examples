import * as cdk from "aws-cdk-lib";
import {
  aws_cloudwatch as cloudwatch,
  aws_ecs as ecs,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_iam as iam,
  aws_s3 as s3,
  aws_sqs as sqs,
  aws_s3_notifications as s3_notifications,
  aws_sns as sns,
  aws_sns_subscriptions as sns_subscriptions,
} from "aws-cdk-lib";
import { Schedule, ScheduleExpression } from "@aws-cdk/aws-scheduler-alpha";
import { LambdaInvoke } from "@aws-cdk/aws-scheduler-targets-alpha";
import { Construct } from "constructs";
import { join } from "path";

export class ServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Create resources related to our icons bucket.
     */

    const graphicsBucket = new s3.Bucket(this, "graphicsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Delegate access control to the access point
    graphicsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "DelegateAccessToAccessPoint",
        effect: iam.Effect.ALLOW,
        actions: ["*"],
        principals: [new iam.AnyPrincipal()],
        resources: [
          graphicsBucket.bucketArn,
          graphicsBucket.arnForObjects("*"),
        ],
        conditions: {
          StringEquals: {
            "s3:DataAccessPointAccount": this.account,
          },
        },
      })
    );

    const designUser = new iam.User(this, "designUser");

    // Create an access key for our users for cli operations
    new iam.AccessKey(this, "designUserAccessKey", {
      user: designUser,
      status: iam.AccessKeyStatus.ACTIVE,
    });

    const DESIGN_USER_S3_ACCESS_POINT_NAME = "design-ap" as const;
    const designUserAccessPointArn =
      `arn:aws:s3:${this.region}:${this.account}:accesspoint/${DESIGN_USER_S3_ACCESS_POINT_NAME}` as const;

    const accessPointPolicyDocument = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          sid: "AllowDesignUserGetAndPut",
          effect: iam.Effect.ALLOW,
          actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
          principals: [new iam.ArnPrincipal(designUser.userArn)],
          // When specifying the bucket objects in the access point resource
          // policy, the object resource must always be prepended with /object
          resources: [
            designUserAccessPointArn,
            `${designUserAccessPointArn}/object/*`,
          ],
        }),
      ],
    });

    const designUserAccessPoint = new s3.CfnAccessPoint(
      this,
      "designerAccessPoint",
      {
        bucket: graphicsBucket.bucketName,
        name: DESIGN_USER_S3_ACCESS_POINT_NAME,
        policy: accessPointPolicyDocument,
      }
    );

    const newIconsTopic = new sns.Topic(this, "NewIconsTopic");

    graphicsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3_notifications.SnsDestination(newIconsTopic),
      { prefix: "icons/" }
    );

    /**
     * Create resources related to our ecs services
     */

    // Individual ECS services will be used to process each of the different
    // icons sizes. Use a single cluster to unify these services under the same
    // namespace.
    const serviceCluster = new ecs.Cluster(this, "iconResizeServiceCluster", {
      enableFargateCapacityProviders: true,
    });

    serviceCluster.addDefaultCapacityProviderStrategy([
      {
        capacityProvider: "FARGATE",
        // Direct all traffic in this cluster to Fargate
      },
    ]);

    // Create a log group to capture all of the fargate service logs
    const serviceLogGroup = new logs.LogGroup(
      this,
      "iconResizeServiceLogGroup",
      {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        retention: logs.RetentionDays.FIVE_DAYS,
      }
    );

    const iconSize = 16 as const;

    const ecsTargetMetric = new cloudwatch.Metric({
      namespace: "Service/ImageResize",
      metricName: "EcsTargetMetric",
      dimensionsMap: {
        IconSize: `size${iconSize}`,
      },
      period: cdk.Duration.minutes(1),
      account: this.account,
      region: this.region,
    });

    const iconResizeQueue = new sqs.Queue(
      this,
      `iconResizeQueueSize${iconSize}`
    );
    newIconsTopic.addSubscription(
      new sns_subscriptions.SqsSubscription(iconResizeQueue)
    );

    const iconResizeTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      `iconResizeTaskDefinitionSize${iconSize}`,
      {
        cpu: 256,
        memoryLimitMiB: 512,
      }
    );
    iconResizeTaskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:DeleteMessageBatch",
        ],
        resources: [iconResizeQueue.queueArn],
      })
    );
    iconResizeTaskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [
          graphicsBucket.bucketArn,
          graphicsBucket.arnForObjects("icons/*"),
        ],
      })
    );

    const iconResizeContainer = iconResizeTaskDefinition.addContainer(
      `iconResizeContainerSize${iconSize}`,
      {
        image: ecs.ContainerImage.fromAsset(
          join(__dirname, "..", "src", "icon-resize")
        ),
        environment: {
          SQS_URL: iconResizeQueue.queueUrl,
          ICONS_BUCKET_ARN: graphicsBucket.bucketArn,
        },
        logging: new ecs.AwsLogDriver({
          streamPrefix: `size${iconResizeQueue}`,
          logGroup: serviceLogGroup,
        }),
      }
    );

    const iconResizeService = new ecs.FargateService(
      this,
      `iconResizeServiceSize${iconSize}`,
      {
        cluster: serviceCluster,
        taskDefinition: iconResizeTaskDefinition,
        desiredCount: 0,
      }
    );

    // const scaling = iconResizeService.autoScaleTaskCount({
    //   minCapacity: 0,
    //   maxCapacity: 1,
    // });

    // // Setup scaling metric and cooldown period
    // scaling.scaleOnMetric("QueueMessagesVisibleScaling", {
    //   metric: iconResizeQueue.metricApproximateNumberOfMessagesVisible(),
    //   adjustmentType: autoscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    //   cooldown: cdk.Duration.seconds(300),
    //   scalingSteps: [
    //     { upper: 0, change: -1 },
    //     { lower: 1, change: +1 },
    //   ],
    // });

    /**
     * Define code to schedule our custom metric to be computed
     */

    const targetMetricComputeLambda = new lambda.Function(
      this,
      "targetMetricComputeLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: "lambda.handler",
        code: lambda.Code.fromAsset(
          join(__dirname, "..", "src", "metric-lambda")
        ),
        environment: {
          // Use toJsonString in case we have any unresolved tokens, see:
          // https://docs.aws.amazon.com/cdk/v2/guide/tokens.html
          RESOURCES_STRING: cdk.Stack.of(this).toJsonString([
            {
              Size: 16,
              SqsUrl: iconResizeQueue.queueUrl,
              Cluster: serviceCluster.clusterName,
              ServiceName: iconResizeService.serviceName,
            },
          ]),
        },
      }
    );

    const target = new LambdaInvoke(targetMetricComputeLambda, {});

    const schedule = new Schedule(this, "targetMetricComputeSchedule", {
      target,
      schedule: ScheduleExpression.rate(cdk.Duration.minutes(1)),
    });
  }
}
