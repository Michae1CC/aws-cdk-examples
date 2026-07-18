import {
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as cloudfront_origins,
  aws_elasticloadbalancingv2 as elbv2,
  aws_route53 as route53,
  aws_wafv2 as wafv2,
  Annotations,
  StackProps,
} from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";

interface Props extends StackProps {
  nginxClusterNlb: elbv2.NetworkLoadBalancer;
  hostedZone: route53.IHostedZone;
}

export class CloudfrontStack extends cdk.Stack {
  public readonly distribution: cloudfront.IDistribution;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    if (this.region !== "us-east-1") {
      throw new Error("The stack's region must only be set to us-east-1.");
    }

    if (process.env.DOMAIN === undefined) {
      throw new Error("DOMAIN not set in environment");
    }

    /**
     * An ACM TLS certificate for the Cloudfront distribution.
     */
    const distributionCertificate = new acm.Certificate(
      this,
      "distribution-certificate",
      {
        domainName: process.env.DOMAIN,
        validation: acm.CertificateValidation.fromDns(props.hostedZone),
      },
    );

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

    /**
     * WAF ACL which is attached to the Cloudfront distributions.
     */
    const cfWafAcl = new wafv2.CfnWebACL(this, "cf-waf-acl", {
      scope: "CLOUDFRONT",
      defaultAction: {
        allow: {},
      },
      // Enabled metrics and sample requests for rule violations
      visibilityConfig: {
        metricName: "cf-waf",
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "AWSManagedRulesCommonRuleSet",
          priority: 0,
          // Do not override the rule group's evaluation result
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
              ruleActionOverrides: [
                {
                  actionToUse: { count: {} },
                  name: "NoUserAgent_HEADER",
                },
              ],
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: "cf-waf-aws-managed-rules-common-rule-set",
          },
        },
      ],
    });

    this.distribution = new cloudfront.Distribution(this, "distribution", {
      enabled: true,
      webAclId: cfWafAcl.attrArn,

      // Default to the lattice proxy
      defaultBehavior: {
        origin: cloudfront_origins.VpcOrigin.withVpcOrigin(nginxClusterOrigin),
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        compress: true,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        responseHeadersPolicy:
          cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },

      // Security
      certificate: distributionCertificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2025,
    });

    // Access the underlying L1 CfnDistribution
    const cfnDistribution = this.distribution.node
      .defaultChild as cloudfront.CfnDistribution;

    cfnDistribution.addPropertyOverride(
      "DistributionConfig.ConnectionMode",
      "tenant-only",
    );
    // You can't specify the IsIPV6Enabled field for a multi-tenant distribution.
    // IPv6 settings are managed at the connection group level.
    cfnDistribution.addPropertyDeletionOverride(
      "DistributionConfig.IPV6Enabled",
    );
    cfnDistribution.addPropertyOverride("DistributionConfig.TenantConfig", {
      ParameterDefinitions: [
        {
          Name: "tenantName",
          Definition: {
            StringSchema: {
              Required: true,
            },
          },
        },
      ],
    });

    Annotations.of(this.distribution).acknowledgeWarning(
      "@aws-cdk/aws-cloudfront:emptyDomainNames",
    );
  }
}
