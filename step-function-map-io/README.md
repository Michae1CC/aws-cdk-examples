# Concurrently Image Downloading with AWS Step Functions

AWS Step Functions allow you to create state machines that follow a fixed or dynamic sequence of
steps with great integration with other AWS products. To use AWS step functions
we can create a state machine to define the application workflow which dictates
which passes input and output between states and determine when/where states
are executed. This example explores how we can create a step function to
concurrently download hundreds on images while staying completely serverless!
The step function expect the following fields in the input json

* baseUrl - This base url that the step function will use to download the images
* resourcePaths - From the base url, this is a list of paths to each of the images
* lambdaConcur - The is the maximum number of concurrent download requests each of our
    lambda can make. We want this value set to prevent making too many requests to
    the site hosting the images.

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

## Step Function Tasks and Resources

I'll only go through explaining a single task since they all more or less the
same way:

1. Set up resources for the task
2. Pass the resources created above to a new step function task
3. Specify inputs paths hand down from previous tasks for the new task
4. Specify outputs paths to be passed onto subsequent tasks in the new task

Let's look at how the map download works since it's perhaps one of the more complicated
tasks. Following the above guide, we will first need the lambda that wil be used to download the images.

```typescript
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
```

The usage of the `command` argument in above is used to install python libraries
required for our lambda to run. Since our download lambda will be saving the downloaded images to s3, we will need
to provide write permissions to `downloadLambda`.

```typescript
// Allows us to save downloaded images to s3
imagesBucket.grantWrite(downloadLambda);
```

Create the new task and specifying the inputs and outputs will be a bit tricker
since map tasks expect an array of items where each item is passed to another task,
called the iterator task, that is use to process a single item. We can start by 
creating the iterator task. The iterator task will run our `downloadLambda` from
above using the entire input from the batching stage. Since data passed between
tasks is all JSON, we can use
[JSONPath Syntax](https://support.smartbear.com/alertsite/docs/monitors/api/endpoint/jsonpath.html)
to select specific parts of JSON we would like from our inputs/to send to our
task output. We can tell the iterator task to use the entire input by
specifying `'$'` as our input path. The `'$'` represents the entire JSON object.
Will we also want to keep the entire output from each of the iterator task. We
setup the image download lambda using the `LambdaInvoke` construct.

```typescript
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
```

To determine the input and output paths for our map task, the `batchLambda`
produces a output similar to the following

```json
{
  "name": "batchLambdaTask",
  "output": {
    "tasks": [
      {
        "resourcePaths": [
          "ad/ad.gif",
          "ae/ae.gif",
          "af/af.gif",
          "ag/ag.gif",
          "al/al.gif"
        ],
        "batchInput": {
          "baseUrl": "https://www.fluentpython.com/data/flags",
          "lambdaConcur": 5
        }
      },
      {
        "resourcePaths": [
          "am/am.gif",
          "ao/ao.gif",
          "ar/ar.gif",
          "at/at.gif",
          "au/au.gif"
        ],
        "batchInput": {
          "baseUrl": "https://www.fluentpython.com/data/flags",
          "lambdaConcur": 5
        }
      },
      ...
    ]
  },
  "outputDetails": {
    "truncated": false
  }
}
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
