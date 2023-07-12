import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Vpc, SubnetType } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage } from "aws-cdk-lib/aws-ecs";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { CfnWebACL, CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { join } from "path";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export class WafVpcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdaPasswordGenerator = new Function(this, "AdminTokenGenerator", {
      runtime: Runtime.NODEJS_18_X,
      handler: "handler.handler",
      memorySize: 256,
      timeout: cdk.Duration.minutes(5),
      code: Code.fromAsset(join(__dirname, "../lambda")),
    });

    const onEvent = {
      service: "Lambda",
      action: "invoke",
      parameters: {
        FunctionName: lambdaPasswordGenerator.functionName,
        // Synchronously wait for a response from the lambda function
        InvocationType: "RequestResponse",
      },
      physicalResourceId: cdk.custom_resources.PhysicalResourceId.of(
        // Use the arn of the lambda to determine if a new password needs to be created
        lambdaPasswordGenerator.functionArn
      ),
    };

    const tokenGeneratorCustomResource =
      new cdk.custom_resources.AwsCustomResource(
        this,
        "TokenGeneratorCustomResource",
        {
          policy: cdk.custom_resources.AwsCustomResourcePolicy.fromStatements([
            new PolicyStatement({
              actions: ["lambda:InvokeFunction"],
              effect: Effect.ALLOW,
              resources: [lambdaPasswordGenerator.functionArn],
            }),
          ]),
          timeout: cdk.Duration.minutes(5),
          onCreate: onEvent,
          onUpdate: onEvent,
          resourceType: "Custom::AdminTokenGenerate",
        }
      );

    // Add dependecy on the ssm parameter
    new cdk.CfnOutput(this, "tropofyAdminToken", {
      value: tokenGeneratorCustomResource.getResponseField(
        "Payload.tropofyAdminToken"
      ),
    });
  }

  generateWaf(): void {
    const secreteToken: string = "pineapple" as const;

    // Create a string parameter value
    new StringParameter(this, "waftoken", {
      parameterName: "WAF_TOKEN",
      stringValue: secreteToken,
    });

    // Create our Web ACL
    let webACL = new CfnWebACL(this, "WebACL", {
      scope: "REGIONAL",
      description: "I like pineapple on pizza",
      defaultAction: {
        allow: {
          customRequestHandling: {
            insertHeaders: [{ name: "Fruit", value: secreteToken }],
          },
        },
      },
      visibilityConfig: {
        metricName: "demo-APIWebACL",
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
      },
      rules: [],
    });

    // EC2
    const vpc = new Vpc(this, "Vpc", {
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "public-subnet",
          subnetType: SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    const cluster = new Cluster(this, "MyCluster", {
      vpc: vpc,
    });

    const fargate = new ApplicationLoadBalancedFargateService(
      this,
      "FargateService",
      {
        assignPublicIp: true,
        cluster: cluster,
        cpu: 512,
        desiredCount: 1,
        memoryLimitMiB: 1024,
        taskImageOptions: {
          image: ContainerImage.fromAsset(join(__dirname, "../server")),
          environment: {
            name: "Fargate Service",
            // We have to make two deploys, make sure the ssm parameter is
            // available before attempting a deploy that retrieves the parameter
            // is this manner.
            WAF_TOKEN: StringParameter.valueForStringParameter(
              this,
              "WAF_TOKEN"
            ),
          },
        },
      }
    );

    new CfnWebACLAssociation(this, "FargateWebACLAss", {
      webAclArn: webACL.attrArn,
      resourceArn: fargate.loadBalancer.loadBalancerArn,
    });
  }
}
