import * as cdk from "aws-cdk-lib";
import { aws_route53 as route53 } from "aws-cdk-lib";
import { Construct } from "constructs";

export class ElbPassThroughStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create route 53 resources.

    /**
     * Start by created a Route53 hosted zone. This is comparable to a
     * DNS zone.
     */
    const hostedZone = new route53.HostedZone(this, "awscdkexamplehostedzone", {
      zoneName: "michaelciccotostocampawscdkexample.com",
    });

    new cdk.CfnOutput(this, "hostedzoneNs", {
      value: this.toJsonString(hostedZone.hostedZoneNameServers!),
      description: "NS records for the domain",
    });
  }
}
