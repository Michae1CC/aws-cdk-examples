import * as cdk from "aws-cdk-lib";
import {
  aws_iam as iam,
  aws_kms as kms,
  aws_route53 as route53,
} from "aws-cdk-lib";
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
        process.env.APEX_NS_1!,
        process.env.APEX_NS_2!,
        process.env.APEX_NS_3!,
        process.env.APEX_NS_4!,
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
    const apexKmsKey = new kms.Key(this, "apexKSK", {
      keySpec: kms.KeySpec.ECC_NIST_P256,
      keyUsage: kms.KeyUsage.SIGN_VERIFY,
    });

    // Add to the resources policy of the KMS key to allow AWS route53 to use the customer managed
    // keys, see: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/access-control-managing-permissions.html#KMS-key-policy-for-DNSSEC
    apexKmsKey.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("dnssec-route53.amazonaws.com")],
        resources: [apexKmsKey.keyArn],
        actions: ["kms:DescribeKey", "kms:GetPublicKey", "kms:Sign"],
      })
    );

    apexKmsKey.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("dnssec-route53.amazonaws.com")],
        resources: [apexKmsKey.keyArn],
        actions: ["kms:CreateGrant"],
        conditions: {
          Bool: {
            "kms:GrantIsForAWSResource": true,
          },
        },
      })
    );

    // Create a KSK for the service hosted zone and provide the same permissions
    const serviceKmsKey = new kms.Key(this, "serviceKmsKey", {
      keySpec: kms.KeySpec.ECC_NIST_P256,
      keyUsage: kms.KeyUsage.SIGN_VERIFY,
    });

    serviceKmsKey.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("dnssec-route53.amazonaws.com")],
        resources: [serviceKmsKey.keyArn],
        actions: ["kms:DescribeKey", "kms:GetPublicKey", "kms:Sign"],
      })
    );

    serviceKmsKey.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("dnssec-route53.amazonaws.com")],
        resources: [serviceKmsKey.keyArn],
        actions: ["kms:CreateGrant"],
        conditions: {
          Bool: {
            "kms:GrantIsForAWSResource": true,
          },
        },
      })
    );

    /**
     * Enable DNSSEC for our hosted zones, using the customer managed keys
     * created above as the KSKs.
     */
    const apexKsk = new route53.CfnKeySigningKey(this, "apexKsk", {
      name: "apexKsk",
      status: "ACTIVE",
      hostedZoneId: apexHostedZone.hostedZoneId,
      keyManagementServiceArn: apexKmsKey.keyArn,
    });

    const apexDnssec = new route53.CfnDNSSEC(this, "apexDnssec", {
      hostedZoneId: apexHostedZone.hostedZoneId,
    });
    apexDnssec.node.addDependency(apexKsk);

    const serviceKsk = new route53.CfnKeySigningKey(this, "serviceKsk", {
      name: "serviceKsk",
      status: "ACTIVE",
      hostedZoneId: serviceHostedZone.hostedZoneId,
      keyManagementServiceArn: serviceKmsKey.keyArn,
    });

    const serviceDnssec = new route53.CfnDNSSEC(this, "serviceDnssec", {
      hostedZoneId: serviceHostedZone.hostedZoneId,
    });
    serviceDnssec.node.addDependency(serviceKsk);
  }
}
