import * as cdk from "aws-cdk-lib";
import { aws_route53 as route53 } from "aws-cdk-lib";
import { Construct } from "constructs";

export class ElbPassThroughStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const hostedZone = new route53.HostedZone(this, "awscdkexamplehostedzone", {
      zoneName: "michaelciccotostocampawscdkexample.com",
    });

    new cdk.CfnOutput(this, "hostedzoneNs", {
      value: this.toJsonString(hostedZone.hostedZoneNameServers!),
      description: "NS records for the domain",
    });
  }
}
