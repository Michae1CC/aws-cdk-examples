import { aws_kms as kms, aws_route53 as route53 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { KeySpec, KeyUsage } from "aws-cdk-lib/aws-kms";
import { Construct } from "constructs";

export class Route53 extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainName = "awscdkeg.net" as const;
    const subDomainName =
      "service.awscdkeg.net" satisfies `${string}.${typeof domainName}`;

    const apexHostedZone = route53.HostedZone.fromLookup(
      this,
      "apexHostedZone",
      {
        domainName,
      }
    );

    const serviceHostedZone = new route53.HostedZone(
      this,
      "serviceHostedZone",
      {
        zoneName: subDomainName,
      }
    );

    // Add an NS record in our apex hosted zone to delegate queries for
    // our service domain to our service hosted zone
    new route53.NsRecord(this, "serviceNsRecord", {
      zone: apexHostedZone,
      recordName: subDomainName,
      // I've had to manually type in the name servers since the hostedZone
      // constructs will return undefined for the hostedZoneNameServers if the
      // hosted zone was not created in this stack.
      values: [
        // TODO: Add the name servers
      ],
      ttl: cdk.Duration.minutes(5),
    });

    /**
     * Create the Key Signing Keys for both the apex and service hosted zones.
     *
     * The key must be an asymmetric key with an ECC_NIST_P256 key spec,
     * see: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-cmk-requirements.html.
     * These keys are used for signing and verifying.
     */
    const apexKey = new kms.Key(this, "apexKSK", {
      keySpec: kms.KeySpec.ECC_NIST_P256,
      keyUsage: kms.KeyUsage.SIGN_VERIFY,
    });

    // Must specify the kms:SigningAlgorithm in the policy condition, see: https://docs.aws.amazon.com/kms/latest/developerguide/asymmetric-key-specs.html#key-spec-ecc
  }
}
