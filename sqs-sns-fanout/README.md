# SNS-SQS Fanout Architecture

Broadly speaking, fanout architectures are employed in software architecture
design to broadcast a message from one publisher to many subscribers. This
tutorials demonstrates how a fanout architecture can be built using AWS SNS
and AWS SQS. The application from this tutorial will generate events each time
an image icon to added to an AWS S3 bucket. An AWS SNS topic will be notified of the
S3 put event and fanout the event out to multiple SQS queues. Messages from
these queues are consumed by ecs services which will resize the icon and put
it back into s3. Additionally the number of ecs tasks will scale based on the
number of messages in the queue using target scaling.

## S3 Related Resources

To start, let's create a bucket that will store all of our websites icons:

```typescript
const graphicsBucket = new s3.Bucket(this, "graphicsBucket", {
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    versioned: false,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

Let's assume that that this bucket is access by many members of a company and
we would like to scope down the operations performed by designers who will
be uploading and downloading icons and various other images from the bucket.
We can create an S3 access point for the designers and provide the access
point limited permissions to the bucket, in this case to put, get and delete
items.

```typescript
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
```

Additionally, we need to grant the access point to perform these operations
from the s3 bucket.

```typescript
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
```

## Fanning Out Events

AWS SNS is used to fan out put events on our S3 bucket. To start a SNS topic
is created.

```typescript
const newIconsTopic = new sns.Topic(this, "NewIconsTopic");
```

Fortunately, AWS has created an integration between S3 and SNS to make it
very simple to publish put events from S3 to SNS. The CDK for this integration
is shown below, where only objects prefixed with `icons/` generate events.

```typescript
graphicsBucket.addEventNotification(
    s3.EventType.OBJECT_CREATED_PUT,
    new s3_notifications.SnsDestination(newIconsTopic),
    { prefix: "icons/" }
);
```

Each service SQS queue can then subscribes to the SNS topic to each receive
put events for this specific object prefix.

```typescript
const iconResizeQueue = new sqs.Queue(
    this,
    `iconResizeQueueSize${iconSize}`
);
newIconsTopic.addSubscription(
    new sns_subscriptions.SqsSubscription(iconResizeQueue)
);
```

## Resizing Services

Each SQS queue will be consumed by an ECS service (backed by Fargate) to resize
each icon uploaded to S3 buckets `icons/` 'folder' to a specific size.

```typescript
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
```

This service will scale on a metric roughly proportional to the number of
message queued in SQS divided by the number of ecs tasks.

```typescript
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

// ...

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
```

The exact value of the metric is computed in the following python code.

```python
def get_metric_value(
    ecs_task_count: int, approximate_number_of_messages_visible: int, /
) -> int:
    acceptable_messages_per_task = 5

    overprovision_penalty = (
        -0.5
        if (approximate_number_of_messages_visible == 0 and ecs_task_count > 1)
        else 0
    )

    return (
        min(
            1
            + (
                approximate_number_of_messages_visible
                / (acceptable_messages_per_task * ecs_task_count + 1)
            )
            + overprovision_penalty,
            5,
        )
        * 100
    )
```

This metric is computed and pushed to cloudwatch every 10sec using a event-bridge
scheduler.

```typescript
const target = new LambdaInvoke(targetMetricComputeLambda, {});

const schedule = new Schedule(this, "targetMetricComputeSchedule", {
    target,
    schedule: ScheduleExpression.rate(cdk.Duration.minutes(1)),
});
```

## How To Test

First clone the repository

```bash
git clone https://github.com/Michae1CC/aws-cdk-examples
```

and change directory into the `step-function-map-io` folder.

```bash
cd sqs-sns-fanout
```

Run

```bash
npm install
```

to install the required packages to create our Cloudformation template and then

```bash
cdk bootstrap && cdk deploy
```

Make sure you have docker running during this step.

---
Tip: If you're `podman`, or some other image building client, you can specify
the alternative client for cdk by setting the environment variable `CDK_DOCKER`
to the name of the image building command. In the case for podman

```bash
export CDK_DOCKER=podman
```

---

To perform CLI commands with the design user, make sure you create an access
key and save it to `~/.aws/credentials` under the profile name `design`. You
can run

```bash
aws sts get-caller-identity --profile design
```

to ensure you can use the user. Next let's download some icons to
upload to the S3 bucket, the `get-images.sh` will do this for you and save
and number of images from [icons8](https://icons8.com/) to a new `icons`
folder. We can put each of these icons into the s3 bucket using the following
command

```bash
ls icons | xargs -P 5 -I {} aws s3api put-object --profile design --bucket arn:aws:s3:us-east-1:<your-account-number>:accesspoint/design-ap --key icons/{} --body ./icons/{}
```

Uploading these images will cause the queues to be populated with messages of the
newly put icons. This in turn will cause our custom metric to pick up.

[metric-increase](./img/metric-increase.png)

This then causes the target scaling policy to scaling out each of the services.

[increase-provision](./img/increase-provision.png)

After a while, the services will complete processing the messages from the
queue causing the metric to reel in.

[decrease-increase](./img/metric-decrease.png)

This eventually triggers the scale in policy, bringing the number of tasks
back down to 1,

## References

* <https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points.html>
* <https://github.com/aws-samples/aws-cdk-examples/blob/9164f0e582c63d6f5fb0b03576920d330ddfea95/typescript/s3-object-lambda/lib/s3-object-lambda-stack.ts#L82>
* <https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/publishingMetrics.html#high-resolution-metrics>
* <https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points-policies.html#access-points-policy-examples>
* <https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points-policies.html#access-points-delegating-control>
* <https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-access-points.html>
* <https://docs.aws.amazon.com/cdk/v2/guide/how_to_set_cw_alarm.html>
* <https://docs.aws.amazon.com/signin/latest/userguide/introduction-to-iam-user-sign-in-tutorial.html>
* <https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-using-sqs-queue.html>
* <https://github.com/awsdocs/amazon-s3-developer-guide/blob/master/doc_source/using-access-points.md>
* <https://github.com/ksmin23/my-aws-cdk-examples/tree/main/lambda/async-invoke>
* <https://cdkpatterns.com/patterns/filter/?by=EventBridge>
* <https://github.com/cdk-patterns/serverless/tree/main/the-destined-lambda>
* <https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.Bucket.html#addwbreventwbrnotificationevent-dest-filters>
* <https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam.AccessKey.html>
* <https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/run-message-driven-workloads-at-scale-by-using-aws-fargate.html>
* <https://github.com/aws-samples/sqs-fargate-ddb-cdk-go/blob/main/cdk/lib/FargateServiceStack.ts>
* <https://github.com/aws-samples/serverless-patterns/blob/main/eventbridge-sqs-ecs-cdk/src/lib/eb-sqs-ecs-stack.ts>
* <https://github.com/aws-samples/serverless-patterns/blob/main/eventbridge-schedule-to-lambda-cdk/cdk/lib/eventbridge-scehdules-with-cdk-stack.ts>
