import { aws_ec2 as ec2 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class Ex8_P1Stack extends cdk.Stack {
  public readonly transitGateway: ec2.CfnTransitGateway;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const vpc1 = new ec2.Vpc(this, "vpc-1", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 3,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      subnetConfiguration: [
        {
          name: "private",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    this.transitGateway = new ec2.CfnTransitGateway(this, "transit-gw", {
      autoAcceptSharedAttachments: "enable",
      defaultRouteTableAssociation: "enable",
      dnsSupport: "enable",
      // TODO: check
      transitGatewayCidrBlocks: ["10.0.0.0/16", "10.1.0.0/16"],
    });

    new ec2.CfnTransitGatewayAttachment(this, "tgw-attachment", {
      vpcId: vpc1.vpcId,
      transitGatewayId: this.transitGateway.logicalId,
      subnetIds: vpc1.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }).subnetIds,
    });
  }
}
