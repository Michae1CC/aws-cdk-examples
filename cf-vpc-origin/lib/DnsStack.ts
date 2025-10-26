import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_route53 as route53 } from "aws-cdk-lib";

export class DnsStack extends cdk.Stack {
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.hostedZone = route53.HostedZone.fromLookup(this, "hostedzone", {
      domainName: "michael.polymathian.dev",
    });
  }
}
