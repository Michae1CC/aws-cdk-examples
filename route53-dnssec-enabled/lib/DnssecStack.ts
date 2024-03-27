import * as cdk from "aws-cdk-lib";
import { aws_route53 as route53 } from "aws-cdk-lib";
import { Construct } from "constructs";

interface DnssecStackProps extends cdk.StackProps {
  apexHostedZone: route53.IHostedZone;
  serviceHostedZone: route53.IHostedZone;
  serviceKsk: route53.CfnKeySigningKey;
}

export class DnssecStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: DnssecStackProps) {
    super(scope, id, props);
  }
}
