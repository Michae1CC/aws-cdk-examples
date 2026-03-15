import {
  aws_certificatemanager as acm,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_route53 as route53,
  aws_route53_targets as route53_targets,
  aws_vpclattice as vpclattice,
  CfnResource,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface ServiceStackProps extends StackProps {
  hostedZone: route53.IHostedZone;
}

const VPC_CIDR = "10.0.0.0/16" as const;

export class ServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: ServiceStackProps) {
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

    const nlbSg = new ec2.SecurityGroup(this, "nlb-sg", {
      vpc: vpc,
      allowAllOutbound: true,
    });

    nlbSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow pings from any connection",
    );

    // Create an NLB in VPC B to act as a service endpoint
    // const serviceNlb = new elbv2.NetworkLoadBalancer(
    //   this,
    //   "interface-endpoint-nlb",
    //   {
    //     vpc: vpc,
    //     internetFacing: false,
    //     ipAddressType: elbv2.IpAddressType.IPV4,
    //     securityGroups: [nlbSg],
    //     vpcSubnets: vpc.selectSubnets({
    //       subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //     }),
    //   },
    // );

    const latticeServiceNetwork = new vpclattice.CfnServiceNetwork(
      this,
      "vpc-lattice-service-network",
      {
        authType: "NONE",
        sharingConfig: {
          enabled: true,
        },
      },
    );

    const latticeServiceCertificate = new acm.Certificate(
      this,
      "distribution-certificate",
      {
        domainName: "michael.polymathian.dev",
        validation: acm.CertificateValidation.fromDns(props.hostedZone),
      },
    );

    const vpcLatticeService = new vpclattice.CfnService(
      this,
      "lattice-service",
      {
        name: "vpc-lattice-service",
        customDomainName: "michael.polymathian.dev",
        certificateArn: latticeServiceCertificate.certificateArn,
        authType: "NONE",
      },
    );

    /**
     * https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_vpclattice.CfnListener.html
     */
    const listener = new vpclattice.CfnListener(this, "vpc-lattice-listener", {
      serviceIdentifier: vpcLatticeService.attrId,
      protocol: "HTTPS",
      port: 443,
      defaultAction: {
        fixedResponse: {
          statusCode: 404,
        },
      },
    });

    const httpListener = new vpclattice.CfnListener(
      this,
      "vpc-lattice-http-listener",
      {
        serviceIdentifier: vpcLatticeService.attrId,
        protocol: "HTTP",
        port: 80,
        defaultAction: {
          fixedResponse: {
            statusCode: 404,
          },
        },
      },
    );

    new vpclattice.CfnServiceNetworkServiceAssociation(
      this,
      "service-vpc-service-network-association",
      {
        serviceNetworkIdentifier: latticeServiceNetwork.attrId,
        serviceIdentifier: vpcLatticeService.attrId,
      },
    );

    const sneSg = new ec2.SecurityGroup(this, "sne-sg", {
      vpc: vpc,
      allowAllOutbound: true,
    });

    sneSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow pings from any connection",
    );

    sneSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTP);

    sneSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTPS);

    new route53.ARecord(this, "service-a-record", {
      zone: props.hostedZone,
      recordName: "michael.polymathian.dev",
      target: route53.RecordTarget.fromIpAddresses("10.0.116.32"),
    });

    // This may need to be a private link resource
    // https://docs.aws.amazon.com/vpc-lattice/latest/ug/service-network-associations.html#service-network-vpc-endpoint-associations
    // https://docs.aws.amazon.com/vpc/latest/privatelink/concepts.html
    // Interface VPC Endpoint to VPC Lattice

    // const latticeEndpoint = new ec2.InterfaceVpcEndpoint(
    //   this,
    //   "LatticeEndpoint",
    //   {
    //     vpc,
    //     service: new ec2.InterfaceVpcEndpointService(
    //       `com.amazonaws.${this.region}.vpclattice`,
    //     ),
    //     subnets: {
    //       subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //     },
    //     securityGroups: [sneSg],
    //   },
    // );

    /**
     * See: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_vpclattice.CfnServiceNetworkVpcAssociation.html
     */
    // new vpclattice.CfnServiceNetworkVpcAssociation(
    //   this,
    //   "service-network-vpc-association",
    //   {
    //     privateDnsEnabled: true,
    //     securityGroupIds: [sneSg.securityGroupId],
    //     serviceNetworkIdentifier: latticeServiceNetwork.attrId,
    //     vpcIdentifier: vpc.vpcId,
    //   },
    // );

    /**
     *
     */

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
  }
}
