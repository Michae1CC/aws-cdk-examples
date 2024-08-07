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
     * *************************************************************************
     * Create resources related to our icons bucket.
     * *************************************************************************
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
     * *************************************************************************
     * Create resources related to our ecs services
     * *************************************************************************
     */

    // Individual ECS services will be used to process each of the different
    // icons sizes. Use a single cluster to unify these services under the same
    // namespace.
    const serviceCluster = new ecs.Cluster(this, "iconResizeServiceCluster", {
      enableFargateCapacityProviders: true,
    });

    serviceCluster.addDefaultCapacityProviderStrategy([
      {
        // Direct all traffic in this cluster to Fargate
        capacityProvider: "FARGATE",
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

    const sqsQueueArns: Array<string> = [];
    const metricLambdaResourceList: Array<{
      Size: number;
      SqsUrl: string;
      Cluster: string;
      ServiceName: string;
    }> = [];

    // Create a service that will resize the icons that are added to s3
    for (let iconSize of [16, 32, 64] as const) {
      // Create a custom high resolution metric with a resolution of 10sec
      const ecsTargetMetric = new cloudwatch.Metric({
        namespace: "Service/ImageResize",
        metricName: "EcsTargetMetric",
        dimensionsMap: {
          IconSize: `size${iconSize}`,
        },
        period: cdk.Duration.seconds(10),
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
            "sqs:GetQueueAttributes",
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
            graphicsBucket.arnForObjects("*"),
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
            ICON_SIZE: `${iconSize}`,
            ICONS_BUCKET_NAME: graphicsBucket.bucketName,
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
          desiredCount: 1,
          minHealthyPercent: 100,
        }
      );

      const scaling = iconResizeService.autoScaleTaskCount({
        minCapacity: 1,
        maxCapacity: 5,
      });

      scaling.scaleToTrackCustomMetric("queueMessagesVisibleScaling", {
        metric: ecsTargetMetric,
        targetValue: 100,
        scaleInCooldown: cdk.Duration.seconds(30),
        scaleOutCooldown: cdk.Duration.minutes(1),
      });

      metricLambdaResourceList.push({
        Size: iconSize,
        SqsUrl: iconResizeQueue.queueUrl,
        Cluster: serviceCluster.clusterName,
        ServiceName: iconResizeService.serviceName,
      });
      sqsQueueArns.push(iconResizeQueue.queueArn);
    }

    /**
     * *************************************************************************
     * Define infra to schedule the computation of the custom metric
     * *************************************************************************
     */

    // This lambda will be invoked periodically to compute our custom metric
    const targetMetricComputeLambda = new lambda.Function(
      this,
      "targetMetricComputeLambda",
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: "lambda.handler",
        code: lambda.Code.fromAsset(
          join(__dirname, "..", "src", "metric-lambda")
        ),
        timeout: cdk.Duration.minutes(2),
        environment: {
          // Use toJsonString in case we have any unresolved tokens, see:
          // https://docs.aws.amazon.com/cdk/v2/guide/tokens.html
          RESOURCES_STRING: cdk.Stack.of(this).toJsonString(
            metricLambdaResourceList
          ),
        },
      }
    );

    targetMetricComputeLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["cloudwatch:PutMetricData"],
        // AWS docs mentions to specify the wildcard character as the resource:
        // https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/permissions-reference-cw.html
        resources: ["*"],
        conditions: {
          StringEquals: {
            "cloudwatch:namespace": "Service/ImageResize",
          },
        },
      })
    );
    targetMetricComputeLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ecs:ListTasks"],
        resources: ["*"],
        // Condition on the ecs cluster, see:
        // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security_iam_id-based-policy-examples.html
        conditions: {
          ArnEquals: { "ecs:cluster": serviceCluster.clusterArn },
        },
      })
    );
    targetMetricComputeLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["sqs:GetQueueAttributes"],
        resources: sqsQueueArns,
      })
    );

    const target = new LambdaInvoke(targetMetricComputeLambda, {});

    const schedule = new Schedule(this, "targetMetricComputeSchedule", {
      target,
      schedule: ScheduleExpression.rate(cdk.Duration.minutes(1)),
    });
  }
}
