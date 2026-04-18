import {
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface ClientStackProps extends StackProps {
  serviceNlb: elbv2.NetworkLoadBalancer;
}

const VPC_CIDR = "10.0.0.0/16" as const;

export class ClientStack extends Stack {
  constructor(scope: Construct, id: string, props: ClientStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "vpc", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 2,
      natGateways: 1,
      createInternetGateway: true,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr(VPC_CIDR),
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
      ec2.Peer.ipv4(VPC_CIDR),
      ec2.Port.SSH,
      "Allow SSH from vpc CIDR",
    );

    new ec2.Instance(this, "client-instance", {
      vpc: vpc,
      allowAllOutbound: true,
      associatePublicIpAddress: false,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
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

    new ec2.CfnInstanceConnectEndpoint(this, "instance-connect", {
      subnetId: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }).subnetIds[0],
      securityGroupIds: [instanceSg.securityGroupId],
    });

    const nlbEndpointService = new ec2.VpcEndpointService(
      this,
      "nlb-endpoint-service",
      {
        vpcEndpointServiceLoadBalancers: [props.serviceNlb],
        acceptanceRequired: false,
        allowedPrincipals: [new iam.AccountPrincipal(this.account)],
      },
    );

    new ec2.InterfaceVpcEndpoint(this, "vpc-a-nlb-service-endpoint", {
      vpc: vpc,
      service: new ec2.InterfaceVpcEndpointService(
        nlbEndpointService.vpcEndpointServiceName,
      ),
      subnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
    });
  }
}
