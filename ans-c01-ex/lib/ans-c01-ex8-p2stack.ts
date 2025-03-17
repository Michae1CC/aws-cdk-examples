import { aws_ec2 as ec2 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface Ex8_P2StackProps extends cdk.StackProps {
  transitGateway: ec2.CfnTransitGateway;
}

export class Ex8_P2Stack extends cdk.Stack {
  public readonly transitGateway: ec2.CfnTransitGateway;

  constructor(scope: Construct, id: string, props: Ex8_P2StackProps) {
    super(scope, id, props);

    new ec2.CfnTransitGatewayPeeringAttachment(this, "tgw-peer", {
      transitGatewayId: props.transitGateway.attrId,
      // Use the cfn output from the Ex8-P1Tgw2Stack stack here
      peerTransitGatewayId: "<TRANSIT-GW-ATTR-ID>",
      peerAccountId: this.account,
      peerRegion: "us-east-2",
    });
  }
}
