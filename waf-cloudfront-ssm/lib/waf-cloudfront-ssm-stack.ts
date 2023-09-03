import * as cdk from "aws-cdk-lib";
import {
  aws_ssm as ssm,
  aws_ecs as ecs,
  aws_ec2 as ec2,
  aws_wafv2 as wafv2,
  aws_cloudfront as cloudfront,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { TokenGenerator } from "./token-generator";
import { LoadBalancerV2Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { join } from "path";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";

export class WafCloudfrontSsmStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Create a secure token from our custom resource
     */
    const tokenConstructor = new TokenGenerator(this, "header-token", {
      length: 64,
    });

    const tokenParameterStore = new ssm.StringParameter(
      this,
      "header-token-parameter-store",
      { stringValue: tokenConstructor.value }
    );

    // Create our alb ACL
    const albACL = new wafv2.CfnWebACL(this, "AlbACL", {
      scope: "REGIONAL",
      description: "Verify Origin Check WAF",
      defaultAction: {
        block: {},
      },
      visibilityConfig: {
        metricName: "demo-APIWebACL",
        cloudWatchMetricsEnabled: false,
        sampledRequestsEnabled: false,
      },
      // Create a single rule to match our token in our custom header
      rules: [
        {
          action: { allow: {} },
          name: "AllowVerifyString",
          priority: 0,
          statement: {
            byteMatchStatement: {
              fieldToMatch: {
                headers: {
                  matchPattern: {
                    includedHeaders: ["X-Amzn-Waf-Verify-Origin"],
                  },
                  matchScope: "ALL",
                  oversizeHandling: "NO_MATCH",
                },
              },
              positionalConstraint: "EXACTLY",
              searchString: tokenParameterStore.stringValue,
              textTransformations: [
                {
                  priority: 0,
                  type: "NONE",
                },
              ],
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: false,
            metricName: "AlbACLMeterics",
            sampledRequestsEnabled: false,
          },
        },
      ],
    });

    // EC2
    const vpc = new ec2.Vpc(this, "Vpc", {
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "public-subnet",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    const cluster = new ecs.Cluster(this, "MyCluster", {
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
          image: ecs.ContainerImage.fromAsset(join(__dirname, "./server")),
          environment: {
            name: "Fargate Service",
          },
        },
      }
    );

    // Attach our Alb ACL to the loadbalancer created by fargate
    new wafv2.CfnWebACLAssociation(this, "FargateWebACLAss", {
      webAclArn: albACL.attrArn,
      resourceArn: fargate.loadBalancer.loadBalancerArn,
    });

    // Create the ACL for cloudfront
    const cloudfrontACL = new wafv2.CfnWebACL(this, "CloudfrontACL", {
      // Since we're using a cloudfront scope, resources must be created in
      // the us-east-1 region
      scope: "CLOUDFRONT",
      description: "Attaches custom headers to requests made to Cloudfront.",
      defaultAction: {
        allow: {
          customRequestHandling: {
            insertHeaders: [
              {
                // Note that AWS WAF will append "X-Amzn-Waf-"
                // to the provided name, meaning that full name used
                // will be "X-Amzn-Waf-Verify-Origin"
                name: "Verify-Origin",
                value: tokenParameterStore.stringValue,
              },
            ],
          },
        },
      },
      visibilityConfig: {
        metricName: "verify-origin",
        cloudWatchMetricsEnabled: false,
        sampledRequestsEnabled: false,
      },
      // Leave this empty.
      // We are only using this ACL as a cost effective way of attaching
      // custom headers to requests
      rules: [],
    });

    const myDistribution = new cloudfront.Distribution(this, "MyDistribution", {
      defaultBehavior: {
        origin: new LoadBalancerV2Origin(fargate.loadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
      webAclId: cloudfrontACL.attrArn,
    });

    new cdk.CfnOutput(this, "verifyOriginToken", {
      value: tokenParameterStore.stringValue,
    });

    new cdk.CfnOutput(this, "cloudfrontDistributionName", {
      value: myDistribution.domainName,
    });
  }
}
