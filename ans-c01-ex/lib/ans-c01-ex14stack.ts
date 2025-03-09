import { aws_ec2 as ec2, aws_route53 as route53 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface Ex14StackProps extends cdk.StackProps {}

export class Ex14Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Ex14StackProps) {
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

    const instanceSg = new ec2.SecurityGroup(this, "instance-connect-vpc-a", {
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
      "Allow SSH from any connection",
    );

    const instance = new ec2.Instance(this, "databaseInstance", {
      vpc: vpc,
      allowAllOutbound: true,
      associatePublicIpAddress: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.MICRO,
      ),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      securityGroup: instanceSg,
    });

    const privateHostedZone = new route53.PrivateHostedZone(
      this,
      "privateHostedZone",
      {
        vpc: vpc,
        zoneName: "example.com",
      },
    );

    // Create an A Record within our private hosted zone to point to the
    // instance
    new route53.ARecord(this, "instance-a-record", {
      zone: privateHostedZone,
      target: route53.RecordTarget.fromIpAddresses(instance.instancePrivateIp),
    });
  }
}
