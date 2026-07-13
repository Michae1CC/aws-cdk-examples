import {
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as cloudfront_origins,
  aws_elasticloadbalancingv2 as elbv2,
  Annotations,
  StackProps,
} from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

interface Props extends StackProps {
  nginxClusterNlb: elbv2.NetworkLoadBalancer;
}

export class CloudfrontStack extends cdk.Stack {
  public readonly distribution: cloudfront.IDistribution;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const nginxClusterOrigin = new cloudfront.VpcOrigin(
      this,
      "nginx-cluster-origin",
      {
        endpoint: {
          endpointArn: props.nginxClusterNlb.loadBalancerArn,
          domainName: props.nginxClusterNlb.loadBalancerDnsName,
        },
        httpPort: 80,
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      },
    );

    this.distribution = new cloudfront.Distribution(this, "distribution", {
      enabled: true,

      // Default to the lattice proxy
      defaultBehavior: {
        origin: cloudfront_origins.VpcOrigin.withVpcOrigin(nginxClusterOrigin),
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        compress: true,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },

      // Security
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2025,
    });

    const cfnDistribution = this.distribution.node
      .defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addPropertyOverride(
      "DistributionConfig.ConnectionMode",
      "tenant-only",
    );
    cfnDistribution.addPropertyDeletionOverride(
      "DistributionConfig.IPV6Enabled",
    );

    // Acknowledge warning for not giving a domain to a distribution, which is fine in mtsaas
    Annotations.of(this.distribution).acknowledgeWarning(
      "@aws-cdk/aws-cloudfront:emptyDomainNames",
    );
  }
}
