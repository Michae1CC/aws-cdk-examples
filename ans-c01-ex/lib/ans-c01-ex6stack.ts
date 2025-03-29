import { aws_ec2 as ec2 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface Ex6StackProps extends cdk.StackProps {}

export class Ex6Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Ex6StackProps) {
    super(scope, id, props);

    // Create two isolated VPCs

    const vpcA = new ec2.Vpc(this, "vpc-a", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 3,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      subnetConfiguration: [
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    const vpcB = new ec2.Vpc(this, "vpc-b", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 3,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr("10.1.0.0/16"),
      subnetConfiguration: [
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Create a single egress VPC

    const vpcEgress = new ec2.Vpc(this, "vpc-egress", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 3,
      natGateways: 1,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr("10.2.0.0/16"),
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    const transitGateway = new ec2.CfnTransitGateway(this, "transit-gw", {
      amazonSideAsn: 64513,
      autoAcceptSharedAttachments: "enable",
      defaultRouteTableAssociation: "disable",
      defaultRouteTablePropagation: "disable",
      dnsSupport: "enable",
    });

    // Create the route tables for the transit gateways. Separate route tables
    // are used to prevent networking between the two private VPCs.

    const vpcAEgressTgwRouteTable = new ec2.CfnTransitGatewayRouteTable(
      this,
      "vpc-a-egress-tgw-route-table",
      {
        transitGatewayId: transitGateway.attrId,
      }
    );

    const vpcBEgressTgwRouteTable = new ec2.CfnTransitGatewayRouteTable(
      this,
      "vpc-b-egress-tgw-route-table",
      {
        transitGatewayId: transitGateway.attrId,
      }
    );

    const ingressTgwRouteTable = new ec2.CfnTransitGatewayRouteTable(
      this,
      "ingress-tgw-route-table",
      {
        transitGatewayId: transitGateway.attrId,
      }
    );

    // Create transit gateway attachments and route table associations and
    // route table propagations for each of the VPCs

    const vpcATgwAttachment = new ec2.CfnTransitGatewayAttachment(
      this,
      "vpc-a-tgw-attachment",
      {
        vpcId: vpcA.vpcId,
        transitGatewayId: transitGateway.attrId,
        subnetIds: vpcA.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }).subnetIds,
      }
    );

    new ec2.CfnTransitGatewayRouteTableAssociation(
      this,
      "vpc-a-tgw-route-table-association",
      {
        transitGatewayAttachmentId: vpcATgwAttachment.attrId,
        transitGatewayRouteTableId:
          vpcAEgressTgwRouteTable.attrTransitGatewayRouteTableId,
      }
    );

    new ec2.CfnTransitGatewayRouteTablePropagation(
      this,
      "vpc-a-tgw-route-table-propagation",
      {
        transitGatewayAttachmentId: vpcATgwAttachment.attrId,
        transitGatewayRouteTableId:
          ingressTgwRouteTable.attrTransitGatewayRouteTableId,
      }
    );

    const vpcBTgwAttachment = new ec2.CfnTransitGatewayAttachment(
      this,
      "vpc-b-tgw-attachment",
      {
        vpcId: vpcB.vpcId,
        transitGatewayId: transitGateway.attrId,
        subnetIds: vpcB.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }).subnetIds,
      }
    );

    new ec2.CfnTransitGatewayRouteTableAssociation(
      this,
      "vpc-b-tgw-route-table-association",
      {
        transitGatewayAttachmentId: vpcBTgwAttachment.attrId,
        transitGatewayRouteTableId:
          vpcBEgressTgwRouteTable.attrTransitGatewayRouteTableId,
      }
    );

    new ec2.CfnTransitGatewayRouteTablePropagation(
      this,
      "vpc-b-tgw-route-table-propagation",
      {
        transitGatewayAttachmentId: vpcBTgwAttachment.attrId,
        transitGatewayRouteTableId:
          ingressTgwRouteTable.attrTransitGatewayRouteTableId,
      }
    );

    const vpcEgressTgwAttachment = new ec2.CfnTransitGatewayAttachment(
      this,
      "vpc-egress-tgw-attachment",
      {
        vpcId: vpcEgress.vpcId,
        transitGatewayId: transitGateway.attrId,
        subnetIds: vpcEgress.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnetIds,
      }
    );

    new ec2.CfnTransitGatewayRoute(this, "vpc-b-tgw-egress-route", {
      destinationCidrBlock: "0.0.0.0/0",
      transitGatewayRouteTableId:
        vpcBEgressTgwRouteTable.attrTransitGatewayRouteTableId,
      transitGatewayAttachmentId: vpcEgressTgwAttachment.attrId,
    });

    new ec2.CfnTransitGatewayRoute(this, "vpc-a-tgw-egress-route", {
      destinationCidrBlock: "0.0.0.0/0",
      transitGatewayRouteTableId:
        vpcAEgressTgwRouteTable.attrTransitGatewayRouteTableId,
      transitGatewayAttachmentId: vpcEgressTgwAttachment.attrId,
    });

    new ec2.CfnTransitGatewayRouteTableAssociation(
      this,
      "vpc-egress-tgw-route-table-association",
      {
        transitGatewayAttachmentId: vpcEgressTgwAttachment.attrId,
        transitGatewayRouteTableId:
          ingressTgwRouteTable.attrTransitGatewayRouteTableId,
      }
    );

    // Create routes to the egress VPC via the TGW on each of the private-only VPCs

    vpcA
      .selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      })
      .subnets.forEach((subnet, index) => {
        new ec2.CfnRoute(this, `vpc-a-egress-tgw-route-${index}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: "0.0.0.0/0",
          transitGatewayId: transitGateway.attrId,
        });
      });

    vpcB
      .selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      })
      .subnets.forEach((subnet, index) => {
        new ec2.CfnRoute(this, `vpc-b-egress-tgw-route-${index}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: "0.0.0.0/0",
          transitGatewayId: transitGateway.attrId,
        });
      });

    // Create routes from the egress VPC back to the private-only VPCs via the TGW

    vpcEgress
      .selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      })
      .subnets.forEach((subnet, index) => {
        new ec2.CfnRoute(this, `vpc-egress-a-tgw-route-${index}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: vpcA.vpcCidrBlock,
          transitGatewayId: transitGateway.attrId,
        });
      });

    vpcEgress
      .selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      })
      .subnets.forEach((subnet, index) => {
        new ec2.CfnRoute(this, `vpc-egress-b-tgw-route-${index}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: vpcB.vpcCidrBlock,
          transitGatewayId: transitGateway.attrId,
        });
      });

    const instanceSg = new ec2.SecurityGroup(this, "instance-sg", {
      vpc: vpcA,
      allowAllOutbound: true,
    });

    instanceSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow pings from any connection"
    );

    instanceSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.SSH,
      "Allow SSH from any connection"
    );

    new ec2.Instance(this, "instance", {
      vpc: vpcA,
      requireImdsv2: true,
      allowAllOutbound: true,
      associatePublicIpAddress: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO
      ),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      securityGroup: instanceSg,
    });

    new ec2.CfnInstanceConnectEndpoint(this, "instance-connect", {
      subnetId: vpcA.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds[0],
      securityGroupIds: [instanceSg.securityGroupId],
    });
  }
}
