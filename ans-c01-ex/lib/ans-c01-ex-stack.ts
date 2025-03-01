import {
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
} from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class Ex1_2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

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

    const vpcAVpcBPeeringConnection = new ec2.CfnVPCPeeringConnection(
      this,
      "vpc-a-vpc-b-peer",
      {
        peerVpcId: vpcA.vpcId,
        vpcId: vpcB.vpcId,
        peerOwnerId: props.env?.region,
      },
    );

    // Add the CIDR range of VPC A to VPC B and vice-versa
    vpcB
      .selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED })
      .subnets.forEach((subnet, index) => {
        new ec2.CfnRoute(this, `vpc-a-vpc-b-peer-${index}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: "10.0.0.0/16",
          vpcPeeringConnectionId: vpcAVpcBPeeringConnection.attrId,
        });
      });

    vpcA
      .selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED })
      .subnets.forEach((subnet, index) => {
        new ec2.CfnRoute(this, `vpc-b-peer-${index}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: "10.1.0.0/16",
          vpcPeeringConnectionId: vpcAVpcBPeeringConnection.attrId,
        });
      });

    // Create an interface endpoint for the KMS service
    const kmsInterfaceEndPoint = new ec2.InterfaceVpcEndpoint(
      this,
      "kms-endpoint",
      {
        service: ec2.InterfaceVpcEndpointAwsService.KMS,
        vpc: vpcB,
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      },
    );

    kmsInterfaceEndPoint.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        resources: ["*"],
        actions: ["kms:ListKeys", "kms:ListAliases"],
      }),
    );

    // Create a security group for the instance connect endpoint for VPC a
    const instanceConnectASg = new ec2.SecurityGroup(
      this,
      "instance-connect-vpc-a",
      {
        vpc: vpcA,
        allowAllOutbound: true,
      },
    );

    instanceConnectASg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow pings from any connection",
    );
    instanceConnectASg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.SSH,
      "Allow SSH from any connection",
    );

    // Create a instance connect for VPC A
    new ec2.CfnInstanceConnectEndpoint(this, "vpc-a-instance-connect", {
      subnetId: vpcA.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds[0],
      securityGroupIds: [instanceConnectASg.securityGroupId],
    });

    // Create a security group for the instance connect endpoint for VPC b
    const instanceConnectBSg = new ec2.SecurityGroup(
      this,
      "instance-connect-vpc-b",
      {
        vpc: vpcB,
        allowAllOutbound: true,
      },
    );

    instanceConnectBSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow pings from any connection",
    );
    instanceConnectBSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.SSH,
      "Allow SSH from any connection",
    );

    // Create a instance connect for VPC B
    new ec2.CfnInstanceConnectEndpoint(this, "vpc-b-instance-connect", {
      subnetId: vpcB.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds[0],
      securityGroupIds: [instanceConnectBSg.securityGroupId],
    });

    const nlbSg = new ec2.SecurityGroup(this, "nlb-sg", {
      vpc: vpcB,
      allowAllOutbound: true,
    });

    nlbSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow pings from any connection",
    );

    // Create an NLB in VPC B to act as a service endpoint
    const serviceNlb = new elbv2.NetworkLoadBalancer(this, "vpc-b-nlb", {
      vpc: vpcB,
      internetFacing: false,
      ipAddressType: elbv2.IpAddressType.IPV4,
      securityGroups: [nlbSg],
      vpcSubnets: vpcB.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }),
    });

    const nlbEndpointService = new ec2.VpcEndpointService(
      this,
      "nlb-endpoint-service",
      {
        vpcEndpointServiceLoadBalancers: [serviceNlb],
        acceptanceRequired: false,
        allowedPrincipals: [new iam.AccountPrincipal(this.account)],
      },
    );

    new ec2.InterfaceVpcEndpoint(this, "vpc-a-nlb-service-endpoint", {
      vpc: vpcA,
      service: new ec2.InterfaceVpcEndpointService(
        nlbEndpointService.vpcEndpointServiceName,
      ),
      subnets: vpcA.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }),
    });
  }
}
