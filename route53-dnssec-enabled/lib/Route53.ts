import * as cdk from "aws-cdk-lib";
import {
  aws_iam as iam,
  aws_kms as kms,
  aws_route53 as route53,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class Route53 extends cdk.Stack {
  public readonly apexHostedZone: route53.IHostedZone;
  public readonly serviceHostedZone: route53.IHostedZone;
  public readonly serviceKsk: route53.CfnKeySigningKey;
  public readonly domainName = "awscdkeg.net" as const;
  public readonly subDomainName =
    "service.awscdkeg.net" satisfies `${string}.${typeof this.domainName}`;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.apexHostedZone = route53.HostedZone.fromLookup(
      this,
      "apexHostedZone",
      {
        domainName: this.domainName,
      }
    );

    this.serviceHostedZone = new route53.HostedZone(this, "serviceHostedZone", {
      zoneName: this.subDomainName,
    });

    // Add an NS record in our apex hosted zone to delegate queries for
    // our service domain to our service hosted zone
    new route53.NsRecord(this, "serviceNsRecord", {
      zone: this.apexHostedZone,
      recordName: this.subDomainName,
      values: this.serviceHostedZone.hostedZoneNameServers!,
      ttl: cdk.Duration.minutes(5),
    });

    /**
     * Create the Key Signing Keys for both the apex and service hosted zones.
     *
     * The key must be an asymmetric key with an ECC_NIST_P256 key spec,
     * see: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-cmk-requirements.html.
     * These keys are used for signing and verifying.
     */
    const apexKmsKey = new kms.Key(this, "apexKmsKey", {
      enableKeyRotation: false,
      keySpec: kms.KeySpec.ECC_NIST_P256,
      keyUsage: kms.KeyUsage.SIGN_VERIFY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add to the resources policy of the KMS key to allow AWS route53 to use the customer managed
    // keys, see: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/access-control-managing-permissions.html#KMS-key-policy-for-DNSSEC
    apexKmsKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "Allow Route 53 DNSSEC Service for apex domain KSK",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("dnssec-route53.amazonaws.com")],
        actions: ["kms:DescribeKey", "kms:GetPublicKey", "kms:Sign"],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "aws:SourceAccount": this.account,
          },
          ArnLike: {
            "aws:SourceArn": "arn:aws:route53:::hostedzone/*",
          },
        },
      })
    );

    apexKmsKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "Allow Route 53 DNSSEC Service to CreateGrant for apex domain KSK",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("dnssec-route53.amazonaws.com")],
        actions: ["kms:CreateGrant"],
        resources: ["*"],
        conditions: {
          Bool: {
            "kms:GrantIsForAWSResource": true,
          },
        },
      })
    );

    // Create a KSK for the service hosted zone and provide the same permissions
    const serviceKmsKey = new kms.Key(this, "serviceKmsKey", {
      enableKeyRotation: false,
      keySpec: kms.KeySpec.ECC_NIST_P256,
      keyUsage: kms.KeyUsage.SIGN_VERIFY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    serviceKmsKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "Allow Route 53 DNSSEC Service for service domain KSK",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("dnssec-route53.amazonaws.com")],
        actions: ["kms:DescribeKey", "kms:GetPublicKey", "kms:Sign"],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "aws:SourceAccount": this.account,
          },
          ArnLike: {
            "aws:SourceArn": "arn:aws:route53:::hostedzone/*",
          },
        },
      })
    );

    serviceKmsKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "Allow Route 53 DNSSEC Service to CreateGrant for service domain KSK",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("dnssec-route53.amazonaws.com")],
        actions: ["kms:CreateGrant"],
        resources: ["*"],
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
      hostedZoneId: this.apexHostedZone.hostedZoneId,
      keyManagementServiceArn: apexKmsKey.keyArn,
    });

    const apexDnssec = new route53.CfnDNSSEC(this, "apexDnssec", {
      hostedZoneId: this.apexHostedZone.hostedZoneId,
    });
    apexDnssec.node.addDependency(apexKsk);

    this.serviceKsk = new route53.CfnKeySigningKey(this, "serviceKsk", {
      name: "serviceKsk",
      status: "ACTIVE",
      hostedZoneId: this.serviceHostedZone.hostedZoneId,
      keyManagementServiceArn: serviceKmsKey.keyArn,
    });

    const serviceDnssec = new route53.CfnDNSSEC(this, "serviceDnssec", {
      hostedZoneId: this.serviceHostedZone.hostedZoneId,
    });
    serviceDnssec.node.addDependency(this.serviceKsk);
  }
}
