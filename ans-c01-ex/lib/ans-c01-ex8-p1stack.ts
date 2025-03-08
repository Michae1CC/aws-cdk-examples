import { aws_ec2 as ec2 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface Ex8_P1StackProps extends cdk.StackProps {
  vpcCidr: string;
  transitGatewayAsn: number;
}

export class Ex8_P1Stack extends cdk.Stack {
  public readonly transitGateway: ec2.CfnTransitGateway;

  constructor(scope: Construct, id: string, props: Ex8_P1StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "vpc", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 3,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr(props.vpcCidr),
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const instanceSg = new ec2.SecurityGroup(this, "instance-sg", {
      vpc: vpc,
      allowAllOutbound: true,
    });

    instanceSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow pings from any connection",
    );

    instanceSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.SSH,
      "Allow ssh from any Ipv4",
    );

    this.transitGateway = new ec2.CfnTransitGateway(this, "transit-gw", {
      amazonSideAsn: props.transitGatewayAsn,
      autoAcceptSharedAttachments: "enable",
      defaultRouteTableAssociation: "enable",
      defaultRouteTablePropagation: "enable",
      dnsSupport: "enable",
    });

    new cdk.CfnOutput(this, "attrId", {
      value: this.transitGateway.attrId,
    });

    new ec2.CfnTransitGatewayAttachment(this, "tgw-attachment", {
      vpcId: vpc.vpcId,
      transitGatewayId: this.transitGateway.attrId,
      subnetIds: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }).subnetIds,
    });

    vpc
      .selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      })
      .subnets.forEach((subnet, index) => {
        new ec2.CfnRoute(this, `tgw-route-${index}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: "10.0.0.0/8",
          transitGatewayId: this.transitGateway.attrId,
        });
      });
  }
}
