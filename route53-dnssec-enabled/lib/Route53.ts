import { aws_route53 as route53 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
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
  }
}
