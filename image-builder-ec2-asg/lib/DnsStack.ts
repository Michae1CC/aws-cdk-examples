import { aws_route53 as route53, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";

export class DnsStack extends Stack {
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    if (process.env.DOMAIN === undefined) {
      throw new Error("DOMAIN not set in environment");
    }

    this.hostedZone = route53.HostedZone.fromLookup(this, "hosted-zone", {
      domainName: process.env.DOMAIN,
    });
  }
}
