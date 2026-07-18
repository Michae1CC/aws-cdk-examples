import {
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_route53 as route53,
  aws_wafv2 as wafv2,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface Props extends StackProps {
  distribution: cloudfront.IDistribution;
  connectionGroup: cloudfront.CfnConnectionGroup;
  hostedZone: route53.IHostedZone;
}

export class CloudfrontTenantStack extends Stack {
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    if (process.env.DOMAIN === undefined) {
      throw new Error("DOMAIN not set in environment");
    }

    const tenantDomain = `file.${process.env.DOMAIN}`;

    /**
     * WAF ACL which is attached to the stack's tenant.
     */
    const cfTenantWafAcl = new wafv2.CfnWebACL(this, "cf-waf-acl", {
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
        {
          // Block any request that contains a header whose name begins
          // with 'x-forwarded' (case-insensitive). Recommended by
          // internal security team.
          name: "block-x-forwarded-headers",
          priority: 1,
          action: { block: {} },
          statement: {
            byteMatchStatement: {
              // Match against each individual header name
              fieldToMatch: {
                headers: {
                  matchPattern: { all: {} },
                  matchScope: "KEY",
                  oversizeHandling: "MATCH",
                },
              },
              // Lowercased prefix because WAF normalises header names to lowercase
              searchString: "x-forwarded",
              positionalConstraint: "STARTS_WITH",
              textTransformations: [{ priority: 0, type: "LOWERCASE" }],
            },
          },
          visibilityConfig: {
            metricName: "cf-block-x-forwarded-headers",
            cloudWatchMetricsEnabled: true,
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWSManagedRulesBotControlRuleSet",
          priority: 2,
          // Do not override the rule group's evaluation result
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesBotControlRuleSet",
              ruleActionOverrides: [
                // Taken from lift and shift WAF overrides
                {
                  actionToUse: { count: {} },
                  name: "SignalNonBrowserUserAgent",
                },
                {
                  actionToUse: { count: {} },
                  name: "SignalAutomatedBrowser",
                },
              ],
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `cf-aws-managed-bot-control-rule-set`,
          },
        },
      ],
    });

    const aRecord = new route53.ARecord(this, "distribution-a-record", {
      // NOTE: The ttl cannot be set for AWS alias records
      zone: props.hostedZone,
      // The subdomain name for this record. This should be relative to the zone root name.
      // For example, if you want to create a record for acme.example.com, specify "acme".
      // You can also specify the fully qualified domain name which terminates with a
      // ".". For example, "acme.example.com.".
      recordName: "file",
      target: route53.RecordTarget.fromAlias({
        bind: () => ({
          dnsName: props.connectionGroup.attrRoutingEndpoint,
          hostedZoneId: "Z2FDTNDATAQYW2", // CloudFront's hosted zone ID (never changes)
        }),
      }),
    });

    // const aaaaRecord = new route53.AaaaRecord(
    //   this,
    //   "distribution-aaaa-record",
    //   {
    //     // NOTE: The ttl cannot be set for AWS alias records
    //     zone: props.hostedZone,
    //     recordName: "file",
    //     target: route53.RecordTarget.fromAlias(
    //       new route53_targets.CloudFrontTarget(props.distribution),
    //     ),
    //   },
    // );

    // const distributionTenant = new cloudfront.CfnDistributionTenant(
    //   this,
    //   "PremiumTenant",
    //   {
    //     distributionId: props.distribution.distributionId,
    //     domains: [`files.${process.env.DOMAIN}`],
    //     name: "tenant1",
    //     enabled: true,
    //     parameters: [
    //       {
    //         name: "tenantName",
    //         value: "tenant1",
    //       },
    //     ],
    //     // Override default WAF
    //     customizations: {
    //       webAcl: {
    //         action: "override",
    //         arn: cfTenantWafAcl.attrArn,
    //       },
    //     },
    //   },
    // );

    // distributionTenant.node.addDependency(aRecord);
    // distributionTenant.node.addDependency(aaaaRecord);
  }
}
