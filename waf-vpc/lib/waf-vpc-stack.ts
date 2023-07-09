import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Vpc, SubnetType } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { CfnWebACL, CfnWebACLAssociation } from "aws-cdk-lib/aws-wafv2";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { join } from "path";

export class WafVpcStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
