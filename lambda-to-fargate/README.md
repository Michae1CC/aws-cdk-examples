# Lambda to Fargate

In this [video](https://www.youtube.com/watch?v=tHD3i06Z6gU&t=5s) Matt Coulter compares three methods for using lambda functions to handle incoming requests for a small service. One of the three methods involves containerizing a webframework to handle all the requests from a single lambda. One of the advantages of this is that the code could be moved to fargate with minimal changes, once the service has attracted enough traffic. This example demonstrates what a migration to fargate might look like.

## The Web Framework

We can create a simple server using the typescript express webframework that provides routes to modify a word provided in the url as a query parameter. For example the `uppercase` route will provide a response with the query parameter in uppercase form.

```typescript
export function apiRoutes() {
  const routes = express.Router();

  routes.get("/uppercase", (req: any, res: any) => {
    const input: string = req?.query?.input ?? "default";
    const result = input.toLocaleUpperCase();
    console.log(`result of ${result}`);
    res.status(200).json({ result: result });
  });

  routes.get("/lowercase", (req: any, res: any) => {
    const input: string = req?.query?.input ?? "default";
    const result = input.toLocaleLowerCase();
    console.log(`result of ${result}`);
    res.status(200).json({ result: result });
  });

  routes.get("/capitalize", (req: any, res: any) => {
    const input: string = req?.query?.input ?? "default";
    const result =
      input.charAt(0).toLocaleUpperCase() + 
        input.substring(1).toLocaleLowerCase();
    console.log(`result of ${result}`);
    res.status(200).json({ result: result });
  });

  return routes;
}
```

It's important to note that both the lambda and fargate versions of this service use the __exact same__ `apiRoutes` function. The main difference between lambda and fargate is how we start the application. When using fargate, we spin up our server and have it passively listen for incoming request on port 80, refer to [./server/fargate/index.ts](./server/fargate/index.ts).

```typescript
const app = express()
  .use(express.urlencoded({ extended: false }))
  .use(express.json())
  .use(apiRoutes());

const port = 80;

app.listen(port, () => console.log(`Listening on ${port}`));
```

Things are a little different for our lambda function since lambda functions are not continually running. Instead we can use an open source adapter that takes in our app object and turns it into a lambda handler for us. Matt used the `aws-serverless-express` typescript package, however, at the time of writing it had moved to [`@vendia/serverless-express`](https://github.com/vendia/serverless-express).

```typescript
const app = express()
  .use(express.urlencoded({ extended: false }))
  .use(express.json())
  .use(apiRoutes());

exports.handler = serverlessExpress({ app });
```

## The Lambda Stack

The lambda stack is rather minimal. First we construct a lambda function that runs docker image that builds our serverless app. We can do this fairly easily using the `DockerImageFunction` construct.

```typescript
// lambda function
const myLambda = new DockerImageFunction(this, "LambdaService", {
    code: DockerImageCode.fromImageAsset(join(__dirname, "../server/lambda")),
});
```

Next we create a Http API gateway that routes `GET` requests to our lambda function.

```typescript
const api = new HttpApi(this, "LambdaAPI");
const getLambdaIntegration = new HttpLambdaIntegration("getLambdaProxy", myLambda);

api.addRoutes({
    path: '/{proxy+}', // Adding {proxy+} catches all paths
    methods: [HttpMethod.GET],
    integration: getLambdaIntegration
});
```

## The Fargate Stack

This setup is pretty similar to our lambda stack, although we start by creating a vpc and fargate cluster to distribute and serve requests.

```typescript
const vpc = new Vpc(this, "MyVpc", {
    maxAzs: 3,
});

const cluster = new Cluster(this, "MyCluster", {
    vpc: vpc,
});

const fargate = new ApplicationLoadBalancedFargateService(
    this,
    "FargateService",
    {
    assignPublicIp: false,
    cluster: cluster,
    cpu: 512,
    desiredCount: 1,
    memoryLimitMiB: 2048,
    publicLoadBalancer: false,
    taskImageOptions: {
        image: ContainerImage.fromAsset(join(__dirname, "../server/fargate")),
        environment: {
        name: "Fargate Service",
        },
    },
    }
);
```

Again, we set up a Http API gateway to route requests to fargate, although this time there is a little more set up to connect our gateway to the vpc

```typescript
const httpVpcLink = new CfnResource(this, "HttpVpcLink", {
    type: "AWS::ApiGatewayV2::VpcLink",
    properties: {
    Name: "V2 VPC Link",
    SubnetIds: vpc.privateSubnets.map((m) => m.subnetId),
    },
});

const api = new HttpApi(this, "HttpApiGateway", {
    apiName: "ApigwFargate",
    description:
    "Integration between apigw and Application Load-Balanced Fargate Service",
});

const integration = new CfnIntegration(this, "HttpApiGatewayIntegration", {
    apiId: api.httpApiId,
    connectionId: httpVpcLink.ref,
    connectionType: "VPC_LINK",
    description: "API Integration with AWS Fargate Service",
    integrationMethod: "GET",
    integrationType: "HTTP_PROXY",
    integrationUri: fargate.listener.listenerArn,
    payloadFormatVersion: "1.0", // supported values for Lambda proxy integrations are 1.0 and 2.0. For all other integrations, 1.0 is the only supported value
});

new CfnRoute(this, "Route", {
    apiId: api.httpApiId,
    routeKey: "GET /{proxy+}", // Adding {proxy+} catches all paths
    target: `integrations/${integration.ref}`,
});
```

## How To Test

First clone this repository
```bash
git clone https://github.com/Michae1CC/aws-cdk-examples
```
and change directory into the apigw-to-dynamodb folder.
```bash
cd lambda-to-fargate
```
Run 
```bash
npm install
```
to install the required packages to create Cloudformation template and then
```bash
cdk deploy --all
```
to deploy both the `FargateStack` and `LambdaStack` to the cloud. Make sure Docker is running during the deployment process. The URLs from the lambda and fargate stacks should appear in the output.
```bash
...
FargateStack.FargateAPIGatewayUrl = https://<fargate url>/
...
LambdaStack.LambdaAPIGatewayUrl = https://<lambda url>/
...
```
We can test some of the lambda methods with the following curl commands
```bash
> curl --location --request GET  "https://<lambda url>/lowercase?input=heLLo"
{"result":"hello"}%

> curl --location --request GET  "https://<lambda url>/capitalize?input=hello"
{"result":"Hello"}%
```
We can test these same use cases on the fargate stack to produce the same results.
```bash
> curl --location --request GET "https://<fargate url>/lowercase?input=heLLo"
{"result":"hello"}%

> curl --location --request GET "https://<fargate url>/capitalize?input=hello"
{"result":"Hello"}%
```
Run the following to clean up any resources produced by this service
```bash
cdk destroy --all
```

## References:

- https://www.youtube.com/watch?v=tHD3i06Z6gU&t=5s
- https://github.com/cdk-patterns/serverless/tree/main/the-lambda-trilogy
- https://github.com/aws-samples/serverless-patterns/blob/main/apigw-http-api-lambda-rds-proxy-cdk/src/lib/rds-proxy-sequelize-stack.ts