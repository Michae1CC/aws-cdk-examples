import {
  aws_route53 as route53,
  aws_certificatemanager as acm,
} from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class DnsStack extends cdk.Stack {
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    if (process.env.APEX_DOMAIN === undefined) {
      throw new Error("APEX_DOMAIN not set in environment");
    }

    this.hostedZone = route53.HostedZone.fromLookup(this, "hostedzone", {
      domainName: process.env.APEX_DOMAIN,
    });
  }
}
