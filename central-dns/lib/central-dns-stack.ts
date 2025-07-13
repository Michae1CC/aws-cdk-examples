import {
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_sqs as sqs,
  aws_route53 as route53,
  aws_route53_targets as route53_targets,
} from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class CentralDnsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const vpcHub = new ec2.Vpc(this, "vpc-hub", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 2,
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

    const vpcSpoke = new ec2.Vpc(this, "vpc-spoke", {
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

    const vpcHubSpokePeeringConnection = new ec2.CfnVPCPeeringConnection(
      this,
      "vpc-hub-spoke-peer",
      {
        peerVpcId: vpcHub.vpcId,
        vpcId: vpcSpoke.vpcId,
        peerOwnerId: this.account,
      }
    );

    vpcHub
      .selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED })
      .subnets.forEach((subnet, index) => {
        new ec2.CfnRoute(this, `vpc-hub-spoke-peer-${index}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: "10.1.0.0/16",
          vpcPeeringConnectionId: vpcHubSpokePeeringConnection.attrId,
        });
      });

    vpcSpoke
      .selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED })
      .subnets.forEach((subnet, index) => {
        new ec2.CfnRoute(this, `vpc-spoke-hub-peer-${index}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: "10.0.0.0/16",
          vpcPeeringConnectionId: vpcHubSpokePeeringConnection.attrId,
        });
      });

    const sqsInterfaceSg = new ec2.SecurityGroup(this, "sqs-interface-sg", {
      vpc: vpcHub,
      allowAllOutbound: true,
    });

    sqsInterfaceSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow pings from any connection"
    );

    sqsInterfaceSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTP,
      "Allow HTTP from any connection"
    );

    sqsInterfaceSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTPS,
      "Allow HTTPS from any connection"
    );

    // Create an interface endpoint for the KMS service
    const sqsInterfaceEndPoint = new ec2.InterfaceVpcEndpoint(
      this,
      "sqs-endpoint",
      {
        vpc: vpcHub,
        securityGroups: [sqsInterfaceSg],
        service: ec2.InterfaceVpcEndpointAwsService.SQS,
        privateDnsEnabled: false,
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      }
    );

    sqsInterfaceEndPoint.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.AnyPrincipal()],
        resources: ["*"],
        actions: ["sqs:*"],
      })
    );

    const privateHostedZone = new route53.PrivateHostedZone(
      this,
      "private-hosted-zone",
      {
        vpc: vpcHub,
        zoneName: `sqs.${this.region}.amazonaws.com`,
      }
    );

    new route53.ARecord(this, "sqs-interface-endpoint-a-record", {
      zone: privateHostedZone,
      target: route53.RecordTarget.fromAlias(
        new route53_targets.InterfaceVpcEndpointTarget(sqsInterfaceEndPoint)
      ),
    });

    const testQueue = new sqs.Queue(this, "test-queue");

    new cdk.CfnOutput(this, "test-queue-url", {
      value: testQueue.queueUrl,
    });

    // Create an instance connect endpoint and instance in the first private VPC
    const instanceSg = new ec2.SecurityGroup(this, "instance-sg", {
      vpc: vpcSpoke,
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
      vpc: vpcSpoke,
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
      subnetId: vpcSpoke.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      }).subnetIds[0],
      securityGroupIds: [instanceSg.securityGroupId],
    });
  }
}
