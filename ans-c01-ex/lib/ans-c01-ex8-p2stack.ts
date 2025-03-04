import { aws_ec2 as ec2 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface Ex8_P2StackProps extends cdk.StackProps {
  transitGateway: ec2.CfnTransitGateway;
}

export class Ex8_P2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Ex8_P2StackProps) {
    super(scope, id, props);

    const vpc2 = new ec2.Vpc(this, "vpc-2", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 3,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr("10.1.0.0/16"),
      subnetConfiguration: [
        {
          name: "private",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    new ec2.CfnTransitGatewayAttachment(this, "tgw-attachment", {
      vpcId: vpc2.vpcId,
      transitGatewayId: props.transitGateway.logicalId,
      subnetIds: vpc2.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }).subnetIds,
    });
  }
}
