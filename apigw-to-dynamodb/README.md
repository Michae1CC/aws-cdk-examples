# API Gateway to Dynamodb

Usually when we want to process and save incoming information from API endpoint we would usually have a lambda function out the front to intercept the traffic and perform any necessary processing. This can sometimes be a bad idea since if our lambda function failed, this could mean we loose data. AWS allows us to integrate API gateway with dynamodb to save doing heavy error prone processing upfront and to move down the line.

## Dynamodb

This the premise of our small service. Suppose we own an ice-cream parlour where new promotional flavours are occasionally released. We would like to store the names and prices of these flavours for both our business backend and our website front end. We would also like to notify customers when a new flavours comes out. Store information about our flavours can be done using a Dynamo database.

```typescript
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
    // When the resource is removed, it will be destroyed
    removalPolicy: RemovalPolicy.DESTROY,
    tableName: projectName,
    // Only send images of the record post modification
    stream: dynamodb.StreamViewType.NEW_IMAGE,
});
```

This sets up a table where the flavour of the name will form the key of each entry.

## API Gateway

Next up we will need some sort of public interface to create and delete flavours from our database. AWS API Gateway comes in two main flavours (pun absolutely intended): RestApi and HttpApi. Since HttpApi doesn't support dynamodb integrations we will make use of RestApi.

```typescript
/**
 * API Gateway creation
 */
let restApi = new cdk.aws_apigateway.RestApi(this, "DynamoStreamerAPI", {
    deployOptions: {
    metricsEnabled: true,
    dataTraceEnabled: true,
    stageName: "prod",
    loggingLevel: cdk.aws_apigateway.MethodLoggingLevel.INFO,
    },
    defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
    },
    restApiName: projectName,
});
```

CORS is set up to accept cross origin access from any source. You may want to restrict this for your own application. With our API endpoint set up we can start attaching resources to it.

```typescript
const allResources = restApi.root.addResource(projectName);
const singleResource = allResources.addResource("{flavour}");
```

We will use `allResources` to add new flavours to our database. The `singleResource` will be used to query and delete information on a specific flavour.

## IAM

IAM is a service within AWS which dictates which resources can perform what operations on other resources. By default the API Gateway we defined above won't have permissions to read or write information to our Dynamo database. We can add a IAM policy to permit these operations with the following lines of code.

```typescript
// Provide our gateway with permissions to access our dynamodb table
const apigwDynamodbRole = new iam.Role(this, "DefaultLambdaHandlerRole", {
    assumedBy: new cdk.aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
});
dynamoTable.grantReadWriteData(apigwDynamodbRole);
```

## Integration

To integrate our API Gateway with our database we need to define request templates (what will we send to our service) and integration responses (how we handle various HTTP responses). Here's how defined the response for common errors.

```typescript
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
```

I've defined responses for successful actions within the integrations themselves since the responses differ from integration to integration.

```typescript
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
```

I've defined response models to define the data structure of our payloads. As an example this is the response model of a success response.

```typescript
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
```

The integrations work by extracting information using VTL from the request body and formatting it into a native typescript object which is consumed by dynamodb to be transformed into a database entry. Take the following example.

```typescript
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
```

In this example `flavour` and `cost` values are extracted from the request's data field to make up the field values of the new database item. If the action of inserting a new ice-cream flavour into the database is successful we will get a message back saying _"Added flavour to the table"_.

## Lambda and SNS

We can use a combination of Lambda and SNS to text paterons of a new flavour of ice-cream. We can start by creating our Lambda and SNS Topic.

```typescript
const snsTopic = new sns.Topic(this, projectName + "-sns");
snsTopic.addSubscription(new subscriptions.SmsSubscription("<YOUR NUMBER HERE>"));

/**
 * Lambda dynamo stream subscriber
 */
const dynamoStreamSubscriberLambda = new lambda.Function(
    this,
    "dynamoStreamHandler",
    {
    // Runtime environment
    runtime: lambda.Runtime.PYTHON_3_9,
    code: lambda.Code.fromAsset("lambda"),
    // file is "lambda", function is "handler"
    handler: "lambda.handler",
    environment: { SNS_ARN: snsTopic.topicArn },
    }
);
```

You will need to replace `<YOUR NUMBER HERE>` with the number you would like to test with. We are just added this number to a pool of subscribers that will receive texts from our ice-cream shop. The lambda function will be running the code found in the `lambda` folder, displayed below.

```python
def handler(event, context):
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    logger.info("request: " + json.dumps(event))
    subject = "Gelato"
    client = boto3.client("sns")
    topic_arn = os.environ["SNS_ARN"]

    try:
        flavour = event['Records'][0]['dynamodb']['Keys']['flavour']['S']
        message = f"Come try our new {flavour} flavour"
        sent_message = client.publish(
            TopicArn=topic_arn,
            Message=message,
            Subject=subject
        )
        if sent_message is not None:
            logger.info(f"Success - Message ID: {sent_message['MessageId']}")
        return {
            "statusCode": 200,
            "body": json.dumps("Success")
        }

    except ClientError as e:
        logger.error(e)
        return None
```

This code takes database insertion events, finds the flavour of the newly created ice-cream from the event sends out an SMS message to mobile subscribers. The lambda function knows which SNS resource to publish this message to by passing the SNS Amazon Resource Number to it as an environment variable. To have lambda function invoke on database creation event we need to add the following to our cdk.

```typescript
// Subscribe of lambda to the event stream
dynamoStreamSubscriberLambda.addEventSource(
    new DynamoEventSource(dynamoTable, {
    startingPosition: lambda.StartingPosition.LATEST,
    })
);
```

We will also need to add the following cdk to allow our lambda to use the SNS topic created above.

```typescript
const snsTopicPolicy = new iam.PolicyStatement({
    actions: ["sns:publish"],
    resources: ["*"],
});

dynamoStreamSubscriberLambda.addToRolePolicy(snsTopicPolicy);
```

## How To Test

First clone this repository
```bash
git clone https://github.com/Michae1CC/aws-cdk-examples
```
and change directory into the apigw-to-dynamodb folder.
```bash
cd apigw-to-dynamodb
```
Run 
```bash
npm install
```
to install the required packages to create Cloudformation template and then
```bash
cdk deploy
```
to deploy these resources to the cloud. You should see the url of API endpoint near the bottom of the output which should look something like this
```
Outputs:
ApigwToDynamodbStack.DynamoStreamerAPIEndpointA76F4941 = https://<random text>.<region>.amazonaws.com/prod/
```
We can create a new flavour by sending the following request to our API endpoint using the curl command.
```bash
curl -i -X POST \
   -H "Content-Type:application/json" \
   -d \
'{"flavour": "Pistachio", "cost": "2.00"}' \
 'https://<random text>.<region>.amazonaws.com/prod/ice-cream-flavours'
```
You should hopefully receive an SMS mentioning our new Pistachio flavoured ice-cream!

![SMS-message](./img/SMS_rec.jpg)

We can get information about our new flavour through a `GET` request

```bash
curl -i -X GET \
 'https://<random text>.<region>.amazonaws.com/prod/ice-cream-flavours/Pistachio'

HTTP/2 200 
content-type: application/json
content-length: 58
date: Thu, 09 Mar 2023 12:05:36 GMT
x-amzn-requestid: 3cfb12a5-5fdb-40d9-a929-3c04638391b5
x-amz-apigw-id: Bgy-mHIEIAMF4FQ=
x-amzn-trace-id: Root=1-6409cb90-27d129624a0c4ef27d91d58f
x-cache: Miss from cloudfront
via: 1.1 7fe70ef74e6a71dc6fcd4b1b62861ffc.cloudfront.net (CloudFront)
x-amz-cf-pop: SYD62-P2
x-amz-cf-id: nm6a2HWNxLiSojqLCZtdU0zAa9uVIh0H_AyRgSQa6H5iIBmFQ1eFkQ==

{"Item":{"flavour":{"S":"Pistachio"},"cost":{"S":"2.00"}}}%
```

and also delete it through a `DELETE` request

```bash
curl -i -X DELETE \
 'https://<random text>.<region>.amazonaws.com/prod/ice-cream-flavours/Pistachio'

HTTP/2 200 
content-type: application/json
content-length: 40
date: Thu, 09 Mar 2023 12:06:51 GMT
x-amzn-requestid: 7856711a-e618-433f-9a20-34a5f331b4dd
x-amz-apigw-id: BgzKVFRvoAMFgtg=
x-amzn-trace-id: Root=1-6409cbdb-381689cc57c6591453f2a427
x-cache: Miss from cloudfront
via: 1.1 3fb6aad2d0d4eb57ef667ceeeeca901a.cloudfront.net (CloudFront)
x-amz-cf-pop: SYD62-P2
x-amz-cf-id: nbqzz_Qvg6RL9mY3A4fAoZMbJ5ULwr5mFToK8yJRbYyDrECXzo0iyQ==

{"message":"Removed flavour from table"}%
```

Finally we can clean up all the resources created by this tutorial by running
```bash
cdk destroy
```

## References:

- https://medium.com/@shimo164/cdk-send-amazon-sns-from-aws-lambda-1a0e6c86073e 
- https://github.com/cdk-patterns/serverless
- https://github.com/aws-samples/serverless-patterns/tree/main/apigw-rest-api-dynamodb-cdk