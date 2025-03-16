import { aws_ec2 as ec2 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface Ex9StackProps extends cdk.StackProps {}

export class Ex9Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Ex9StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "vpc", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 3,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const clientVpnEndpoint = vpc.addClientVpnEndpoint("client-vpn-endpoint", {
      cidr: "10.1.0.0/16",
      serverCertificateArn: "<YOUR-SERVER-CERT>",
      authorizeAllUsersToVpcCidr: true,
      clientCertificateArn: "<YOUR-CLIENT-CERT>",
    });

    clientVpnEndpoint.addRoute("client-vpn-public-route", {
      cidr: "0.0.0.0/0",
      target: ec2.ClientVpnRouteTarget.subnet(vpc.publicSubnets[0]),
    });

    clientVpnEndpoint.addAuthorizationRule("client-vpn-public-route-auth", {
      cidr: "0.0.0.0/0",
    });

    const instanceSg = new ec2.SecurityGroup(this, "instance-sg", {
      vpc: vpc,
      allowAllOutbound: true,
    });

    instanceSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow pings from any connection"
    );

    const instance = new ec2.Instance(this, "instance", {
      vpc: vpc,
      allowAllOutbound: true,
      associatePublicIpAddress: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
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

    new cdk.CfnOutput(this, "instance-ipv4", {
      value: instance.instancePrivateIp,
    });
  }
}
