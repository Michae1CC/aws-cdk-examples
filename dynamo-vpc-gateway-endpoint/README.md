# Dynamo Tables to Control Feature Flags

Dynamodb is a NoSQL key-value pair database. The simplicity and flexibility it
offers makes it good for storing ideal for storing data for deployment
configurations of our applications. This tutorial shows how dynamodb may be
set up provide feature flag information to our running applications.

## Dynamo Gateway Endpoint

The structure of our dynamo items will take the following form

```json
{
    "<FeatureName>": string,
    "<ClientId>#<Stage>": string,
    "Value": boolean
}
```

where `FeatureName` will be the primary key and `<ClientId>#<Stage>` is that
if we know the feature and client id then a query can still be made using the
sort key by checking if the sort key begins with the client id.

Compute within the private subnet will be able to query the table for feature
flags via a Gateway Endpoint. An Gateway Endpoint provides network access to
S3 or Dynamo without the need for a NAT gateway. This work by attaching
new routes to the designated subnet route tables. The CDK used to create the
dynamo table and Gateway Endpoint are shown below.

```typescript
/**
 * A regional mapping from the region name to the aws managed prefix list
 * names and ids for dynamodb. You may need to add an entry if you
 * are deploying to a region that I haven't included. You can find the name key
 * and ID value in the vpc console under the "Managed prefix lists" sub section.
 */
const cfnRegionToManagedPrefixList = new cdk.CfnMapping(
    this,
    "cfnRegionToManagedPrefixList",
    {
    mapping: {
        "us-east-1": {
        prefixListName: "com.amazonaws.us-east-1.dynamodb",
        prefixListId: "pl-02cd2c6b",
        },
        "us-east-2": {
        prefixListName: "com.amazonaws.us-east-2.dynamodb",
        prefixListId: "pl-4ca54025",
        },
        "us-west-1": {
        prefixListName: "com.amazonaws.us-west-1.dynamodb",
        prefixListId: "pl-6ea54007",
        },
        "us-west-2": {
        prefixListName: "com.amazonaws.us-west-2.dynamodb",
        prefixListId: "pl-00a54069",
        },
        "ap-southeast-2": {
        prefixListName: "com.amazonaws.ap-southeast-2.dynamodb",
        prefixListId: "pl-62a5400b",
        },
    },
    }
);

const flagTable = new dynamodb.Table(this, "flagTable", {
    partitionKey: {
    name: "Feature",
    type: dynamodb.AttributeType.STRING,
    },
    sortKey: {
    name: "Target",
    type: dynamodb.AttributeType.STRING,
    },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
});

const vpc = new ec2.Vpc(this, "serviceVpc", {
    natGateways: 0,
    maxAzs: 2,
    subnetConfiguration: [
    {
        name: "service",
        cidrMask: 24,
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    },
    ],
});

const dynamoDbEndpoint = vpc.addGatewayEndpoint("dynamoDbEndpoint", {
    service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    // All subnets in the VPC
    subnets: undefined,
});

dynamoDbEndpoint.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
```

Additionally a policy will need to be configured on the endpoint to specify
exacts what API calls can be made and to what resource.

```typescript
dynamoDbEndpoint.addToPolicy(
    new iam.PolicyStatement({
    principals: [new iam.AnyPrincipal()],
    effect: iam.Effect.ALLOW,
    actions: ["dynamodb:*"],
    resources: [flagTable.tableArn],
    })
);
```


## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## References

* <https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html>
* <https://docs.aws.amazon.com/vpc/latest/userguide/working-with-aws-managed-prefix-lists.html>
* <https://aws.amazon.com/blogs/compute/understanding-vpc-links-in-amazon-api-gateway-private-integrations/>
* <https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-private.html>
* <https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigatewayv2_integrations-readme.html#private-integration>
* <https://repost.aws/knowledge-center/api-gateway-application-load-balancers>
* <https://aws.amazon.com/blogs/security/how-to-secure-api-gateway-http-endpoints-with-jwt-authorizer/>
* <https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.Annotations.html>
* <https://sst.dev/examples/how-to-add-github-login-to-your-cognito-user-pool.html>
* <https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html>
* <https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigatewayv2.HttpIntegration.html>
* <https://blog.ducthinh.net/github-openid-idp-aws-cognito/>
* <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github>
* <https://developer.okta.com/docs/reference/api/oidc/#well-known-openid-configuration>
