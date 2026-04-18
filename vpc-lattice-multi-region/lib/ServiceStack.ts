import {
  aws_certificatemanager as acm,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_elasticloadbalancingv2_targets as elbv2_targets,
  aws_route53 as route53,
  aws_route53_targets as route53_targets,
  aws_vpclattice as vpclattice,
  CfnOutput,
  Duration,
  Fn,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface ServiceStackProps extends StackProps {
  hostedZone: route53.IHostedZone;
}

const VPC_CIDR = "10.0.0.0/16" as const;

export class ServiceStack extends Stack {
  public readonly serviceNlb: elbv2.NetworkLoadBalancer;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    if (process.env.APEX_DOMAIN === undefined) {
      throw new Error("APEX_DOMAIN not set in environment");
    }

    const apexDomain: string = process.env.APEX_DOMAIN;
    const serviceDomainName: string = `testservice.${process.env.APEX_DOMAIN}`;

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
        domainName: serviceDomainName,
        validation: acm.CertificateValidation.fromDns(props.hostedZone),
      },
    );

    const vpcLatticeService = new vpclattice.CfnService(
      this,
      "lattice-service",
      {
        name: "vpc-lattice-service",
        customDomainName: serviceDomainName,
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

    // Create the service network endpoint
    //
    // NOTE: The endpoint will provide a DNS host name to access the service,
    //  see: https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-access-service-networks.html#sn-endpoint-dns
    const serviceNetworkEndpoint = new ec2.CfnVPCEndpoint(
      this,
      "lattice-service-network-endpoint",
      {
        // Specify the VPC where the endpoint will be created
        vpcId: vpc.vpcId,
        // This VPC only supports ipv4
        ipAddressType: ec2.IpAddressType.IPV4,
        // Set the endpoint type to ServiceNetwork for VPC Lattice
        vpcEndpointType: ec2.VpcEndpointType.SERVICENETWORK,
        // Specify your service network ARN
        serviceNetworkArn: latticeServiceNetwork.attrArn,
        // Specify the subnets where endpoint network interfaces will be created
        subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),
        // Specify security groups to control access to the endpoint
        securityGroupIds: [sneSg.securityGroupId],
        // Enable private DNS to access services using their private DNS names
        privateDnsEnabled: true,
      },
    );

    // Create a private hosted zone to resolve the custom DNS name within the
    // VPC
    const privateHostedZone = new route53.PrivateHostedZone(
      this,
      "private-hosted-zone",
      {
        vpc: vpc,
        zoneName: apexDomain,
      },
    );

    // Try to figure this out
    // new CfnOutput(this, "cname-record-domainname", {
    //   value: Fn.select(0, serviceNetworkEndpoint.attrDnsEntries).toString(),
    // });

    // new route53.CnameRecord(this, "custom-domain-cname-record", {
    //   zone: privateHostedZone,
    //   // Taken from the console
    //   domainName:
    //     "vpce-0d74970b832a09e18-snsa-0211d0cffce4e10c5.7d67968.vpc-lattice-svcs.ap-southeast-2.on.aws",
    //   recordName: "testservice",
    //   ttl: Duration.minutes(5),
    // });

    // const nlbSg = new ec2.SecurityGroup(this, "nlb-sg", {
    //   vpc: vpc,
    //   allowAllOutbound: true,
    // });

    // nlbSg.addIngressRule(
    //   ec2.Peer.anyIpv4(),
    //   ec2.Port.icmpPing(),
    //   "Allow pings from any connection",
    // );

    // nlbSg.addIngressRule(
    //   ec2.Peer.anyIpv4(),
    //   ec2.Port.HTTP,
    //   "Allow HTTP from any connection",
    // );

    // nlbSg.addIngressRule(
    //   ec2.Peer.anyIpv4(),
    //   ec2.Port.HTTPS,
    //   "Allow HTTP from any connection",
    // );

    // // Create an NLB in VPC B to act as a service endpoint
    // this.serviceNlb = new elbv2.NetworkLoadBalancer(
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

    // // Create target group for the Lattice service
    // // Note: You'll need to use the Lattice service's DNS name as targets
    // const nlbTargetGroup = new elbv2.NetworkTargetGroup(
    //   this,
    //   "nlb-target-group",
    //   {
    //     vpc: vpc,
    //     port: 80,
    //     protocol: elbv2.Protocol.TCP,
    //     targetType: elbv2.TargetType.IP,
    //     // Ip addresses taken from the console
    //     targets: [
    //       new elbv2_targets.IpTarget("10.0.141.44", 80),
    //       new elbv2_targets.IpTarget("10.0.234.37", 80),
    //     ],
    //     healthCheck: {
    //       enabled: true,
    //       protocol: elbv2.Protocol.TCP,
    //       port: "80",
    //     },
    //   },
    // );

    // // Add listener to NLB
    // const serviceNlbListener = this.serviceNlb.addListener("nlb-listener", {
    //   port: 80,
    //   protocol: elbv2.Protocol.TCP,
    //   defaultTargetGroups: [nlbTargetGroup],
    // });

    // const instanceSg = new ec2.SecurityGroup(this, "instance-sg", {
    //   vpc: vpc,
    //   allowAllOutbound: true,
    // });

    // instanceSg.addIngressRule(
    //   ec2.Peer.anyIpv4(),
    //   ec2.Port.icmpPing(),
    //   "Allow pings from any connection",
    // );

    // instanceSg.addIngressRule(
    //   ec2.Peer.ipv4(VPC_CIDR),
    //   ec2.Port.SSH,
    //   "Allow SSH from vpc CIDR",
    // );

    // new ec2.Instance(this, "client-instance", {
    //   vpc: vpc,
    //   allowAllOutbound: true,
    //   associatePublicIpAddress: false,
    //   vpcSubnets: {
    //     subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //   },
    //   instanceType: ec2.InstanceType.of(
    //     ec2.InstanceClass.T2,
    //     ec2.InstanceSize.MICRO,
    //   ),
    //   machineImage: new ec2.AmazonLinuxImage({
    //     generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
    //     cpuType: ec2.AmazonLinuxCpuType.X86_64,
    //   }),
    //   securityGroup: instanceSg,
    // });

    // new ec2.CfnInstanceConnectEndpoint(this, "instance-connect", {
    //   subnetId: vpc.selectSubnets({
    //     subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //   }).subnetIds[0],
    //   securityGroupIds: [instanceSg.securityGroupId],
    // });
  }
}
