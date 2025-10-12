import { aws_ec2 as ec2 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { AWS_VPC_IPV4_SUBNET } from "./const";

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Create the VPC
     */
    this.vpc = new ec2.Vpc(this, "vpc", {
      createInternetGateway: true,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      ipAddresses: ec2.IpAddresses.cidr(AWS_VPC_IPV4_SUBNET),
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      natGateways: 1,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 20,
          ipv6AssignAddressOnCreation: true,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 20,
          ipv6AssignAddressOnCreation: true,
        },
      ],
      flowLogs: {
        "flow-logs-cloudwatch": {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
    });

    const instanceEndpointSg = new ec2.SecurityGroup(this, "instance-sg", {
      vpc: this.vpc,
      allowAllOutbound: true,
    });

    instanceEndpointSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow pings from any connection"
    );

    instanceEndpointSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.SSH,
      "Allow SSH from any connection"
    );

    new ec2.CfnInstanceConnectEndpoint(this, "instance-connect", {
      subnetId: this.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds[0],
      securityGroupIds: [instanceEndpointSg.securityGroupId],
    });
  }
}
