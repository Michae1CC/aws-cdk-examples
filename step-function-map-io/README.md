# Concurrently Image Downloading with AWS Step Functions

AWS Step Functions allow you to create state machines that follow a fixed or dynamic sequence of
steps with great integration with other AWS products. To use AWS step functions
we can create a state machine to define the application workflow which dictates
which passes input and output between states and determine when/where states
are executed. This example explores how we can create a step function to
concurrently download hundreds on images while staying completely serverless!
Images that the step function downloads are stored to a "folder" in s3 where
a dynamodb table will keep track of the url of their images as well as their
object name in s3. Additionally, a SNS topic will notify us of any images that
failed to download.

I've broken up the architecture into three main components:

* Global resources
* Step function tasks and their associated resources
* The step function definition and API gateway integration

## Global Resources

To start, we can define an s3 bucket which will store the images downloaded by
our step function. I've set up my bucket to move object to Glacier Instant
Retrieval after one day.

```typescript
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
```

We will also define a dynamodb table where each row will consist of the url of
a downloaded image as well as the object name within the above s3 bucket. We
will use the url as the key value.

```typescript
// Url to s3 name dynamo table
const urlToNameTable = new dynamodb.Table(this, "urlToName", {
    partitionKey: { name: "url", type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
});
```

## References

* <https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-map-state.html>
* <https://www.datadoghq.com/knowledge-center/aws-step-functions/>
* <https://docs.aws.amazon.com/step-functions/latest/dg/tutorial-itembatcher-param-task.html>
* <https://github.com/cdk-patterns/serverless/tree/main/the-state-machine>
* <https://github.com/aws-samples/serverless-patterns/tree/main/stepfunction-polly-s3-cdk>
* <https://github.com/aws-samples/serverless-patterns/blob/main/stepfunction-ses-cdk/lib/stepfunction-ses-cdk-stack.ts>
* <https://github.com/fluentpython/example-code-2e>
* <https://docs.aws.amazon.com/lambda/latest/dg/API_Operations.html>
* <https://docs.aws.amazon.com/step-functions/latest/dg/concepts-input-output-filtering.html>
