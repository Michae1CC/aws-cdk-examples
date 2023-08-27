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
    let albACL = new wafv2.CfnWebACL(this, "AlbACL", {
      scope: "REGIONAL",
      description: "Verify Origin Check WAF",
      defaultAction: {
        allow: {},
      },
      visibilityConfig: {
        metricName: "demo-APIWebACL",
        cloudWatchMetricsEnabled: false,
        sampledRequestsEnabled: false,
      },
      rules: [],
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

    new wafv2.CfnWebACLAssociation(this, "FargateWebACLAss", {
      webAclArn: albACL.attrArn,
      resourceArn: fargate.loadBalancer.loadBalancerArn,
    });

    const cloudfrontACL = new wafv2.CfnWebACL(this, "CloudfrontACL", {
      // Since we're using a cloudfront scope, resources must be created in
      // the us-east-1 region
      scope: "CLOUDFRONT",
      description:
        "Attaches custom headers to requests made within the corporate vpn that contain an admin page access value.",
      defaultAction: {
        allow: {
          customRequestHandling: {
            insertHeaders: [
              {
                // Note that AWS WAF will append "X-Amzn-Waf-"
                // to the provided name, meaning that full name used
                // will be "X-Amzn-Waf-Verify-Origin"
                name: "Tropofy-Verify-Origin",
                value: tokenParameterStore.stringValue,
              },
            ],
          },
        },
      },
      visibilityConfig: {
        metricName: "verify-origin",
        // CloudWatchMetricsEnabled is used to capture information on
        // the requests coming through the WAF, see: https://docs.aws.amazon.com/waf/latest/developerguide/monitoring-cloudwatch.html#waf-metrics
        // Capturing these metrics will incur additional costs, and we
        // don't need to use them for this use case.
        cloudWatchMetricsEnabled: false,
        // The sampledRequestsEnabled just stores a sample of the
        // requests that pass all the rules (we have no rules so this
        // is redundant), see: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-wafv2-webacl-visibilityconfig.html#cfn-wafv2-webacl-visibilityconfig-sampledrequestsenabled
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
      // webAclId: cloudfrontACL.attrArn,
    });

    new cdk.CfnOutput(this, "verifyOriginToken", {
      value: tokenParameterStore.stringValue,
    });

    new cdk.CfnOutput(this, "cloudfrontDistributionName", {
      value: myDistribution.domainName,
    });
  }
}
