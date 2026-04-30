import {
  aws_certificatemanager as acm,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_iam as iam,
  aws_elasticloadbalancingv2 as elbv2,
  aws_elasticloadbalancingv2_targets as elbv2_targets,
  aws_route53 as route53,
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
const SERVICE_HTTP_PORT_NAME = "service-port";

export class ServiceStack extends Stack {
  public readonly serviceNlb: elbv2.NetworkLoadBalancer;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    if (process.env.APEX_DOMAIN === undefined) {
      throw new Error("ENVARS not set");
    }

    const apexDomain: string = process.env.APEX_DOMAIN;
    const domainName: string = `testservice.${apexDomain}`;

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
      flowLogs: {
        "flow-logs-cloudwatch": {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
    });

    const ecsSecurityGroup = new ec2.SecurityGroup(this, "ecs-sg", {
      vpc: vpc,
      allowAllOutbound: true,
      allowAllIpv6Outbound: true,
    });

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4",
    );

    // You need to allow the inbound rule vpc-lattice prefix to your security
    // group or tasks and health checks can fail.
    //
    // see:
    //  - https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-vpc-lattice-create-service.html
    //  - https://docs.aws.amazon.com/vpc/latest/userguide/working-with-aws-managed-prefix-lists.html
    const vpcLatticePrefixList = ec2.PrefixList.fromLookup(
      this,
      "vpc-lattice-prefix-list",
      {
        prefixListName: `com.amazonaws.${this.region}.vpc-lattice`,
      },
    );

    ecsSecurityGroup.addIngressRule(
      ec2.Peer.prefixList(vpcLatticePrefixList.prefixListId),
      ec2.Port.HTTP,
    );

    const cluster = new ecs.Cluster(this, "cluster", {
      vpc: vpc,
      enableFargateCapacityProviders: true,
    });

    cluster.addDefaultCapacityProviderStrategy([
      {
        capacityProvider: "FARGATE",
        // Direct all the traffic in this cluster to Fargate
        weight: 1,
      },
    ]);

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "task-definition",
      {
        cpu: 256,
        memoryLimitMiB: 512,
      },
    );

    taskDefinition.addContainer("nginx", {
      essential: true,
      containerName: "nginx",
      image: ecs.ContainerImage.fromRegistry("nginx"),
      portMappings: [
        {
          containerPort: 80,
          protocol: ecs.Protocol.TCP,
          name: SERVICE_HTTP_PORT_NAME,
        },
      ],
    });

    const ecsService = new ecs.FargateService(this, "service", {
      cluster: cluster,
      taskDefinition: taskDefinition,
      assignPublicIp: false,
      securityGroups: [ecsSecurityGroup],
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    const privateHostedZone = new route53.PrivateHostedZone(
      this,
      "private-hosted-zone",
      {
        vpc: vpc,
        zoneName: apexDomain,
      },
    );

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
        domainName: domainName,
        validation: acm.CertificateValidation.fromDns(props.hostedZone),
      },
    );

    const vpcLatticeService = new vpclattice.CfnService(
      this,
      "lattice-service",
      {
        name: "vpc-lattice-service",
        customDomainName: domainName,
        certificateArn: latticeServiceCertificate.certificateArn,
        authType: "NONE",
      },
    );

    /**
     * An vpc lattice HTTP target group for the service internal alb.
     */
    const httpTargetGroup = new vpclattice.CfnTargetGroup(
      this,
      "vpc-lattice-service-http-target-group",
      {
        type: "IP", // Use IP type for ECS Fargate tasks
        config: {
          protocol: "HTTP",
          port: 80,
          vpcIdentifier: vpc.vpcId,
          healthCheck: {
            enabled: true,
            path: "/",
            protocol: "HTTP",
            port: 80,
            healthyThresholdCount: 2,
            unhealthyThresholdCount: 3,
            healthCheckIntervalSeconds: 30,
            healthCheckTimeoutSeconds: 5,
          },
        },
      },
    );

    // Create IAM role for ECS VPC Lattice integration
    const ecsVpcLatticeRole = new iam.Role(this, "ecs-vpc-lattice-role", {
      assumedBy: new iam.ServicePrincipal("ecs.amazonaws.com"),
      managedPolicies: [
        // Provides access to other AWS service resources required to manage VPC Lattice feature in ECS workloads on your behalf.
        // see: https://docs.aws.amazon.com/aws-managed-policy/latest/reference/AmazonECSInfrastructureRolePolicyForVpcLattice.html
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonECSInfrastructureRolePolicyForVpcLattice",
        ),
      ],
    });

    // Configure VPC Lattice for ECS Service using L1 construct
    const cfnEcsService = ecsService.node.defaultChild as ecs.CfnService;
    cfnEcsService.vpcLatticeConfigurations = [
      {
        targetGroupArn: httpTargetGroup.attrArn,
        portName: SERVICE_HTTP_PORT_NAME,
        roleArn: ecsVpcLatticeRole.roleArn,
      },
    ];

    /**
     * https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_vpclattice.CfnListener.html
     */
    const listener = new vpclattice.CfnListener(this, "vpc-lattice-listener", {
      serviceIdentifier: vpcLatticeService.attrId,
      protocol: "HTTPS",
      port: 443,
      defaultAction: {
        forward: {
          targetGroups: [
            {
              targetGroupIdentifier: httpTargetGroup.attrId,
              weight: 100,
            },
          ],
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
          forward: {
            targetGroups: [
              {
                targetGroupIdentifier: httpTargetGroup.attrId,
                weight: 100,
              },
            ],
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
        // Automatic DNS management feature on VPC Lattice only applies to
        // Resource Configurations (e.g. RDS databases shared via VPC Lattice),
        // not to VPC Lattice services
        dnsOptions: undefined,
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

    new route53.CnameRecord(this, "service-endpoint-1-cname-record", {
      recordName: "testservice",
      zone: privateHostedZone,
      // Taken from console, you will need a custom construct to automate this
      domainName:
        "vpce-0e769ab91dcb10b19-snsa-07b06c66e01bdd93f.7d67968.vpc-lattice-svcs.ap-southeast-2.on.aws",
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

    nlbSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTP,
      "Allow HTTP from any connection",
    );

    nlbSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTPS,
      "Allow HTTP from any connection",
    );

    // Create an NLB in VPC B to act as a service endpoint
    this.serviceNlb = new elbv2.NetworkLoadBalancer(
      this,
      "interface-endpoint-nlb",
      {
        vpc: vpc,
        internetFacing: false,
        ipAddressType: elbv2.IpAddressType.IPV4,
        securityGroups: [nlbSg],
        vpcSubnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }),
      },
    );

    // Create target group for the Lattice service
    // Note: You'll need to use the Lattice service's DNS name as targets
    const nlbTargetGroup = new elbv2.NetworkTargetGroup(
      this,
      "nlb-target-group",
      {
        vpc: vpc,
        port: 80,
        protocol: elbv2.Protocol.TCP,
        targetType: elbv2.TargetType.IP,
        // Ip addresses of the service endpoint taken from the console,
        // you will need a custom construct to automate this
        targets: [
          new elbv2_targets.IpTarget("10.0.228.235", 80),
          new elbv2_targets.IpTarget("10.0.153.0", 80),
        ],
        healthCheck: {
          enabled: true,
          protocol: elbv2.Protocol.HTTP,
          port: "80",
          path: "/",
          healthyHttpCodes: "200,202",
        },
      },
    );

    // Add listener to NLB
    const serviceNlbListener = this.serviceNlb.addListener("nlb-listener", {
      port: 80,
      protocol: elbv2.Protocol.TCP,
      defaultTargetGroups: [nlbTargetGroup],
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
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
        cpuType: ec2.AmazonLinuxCpuType.X86_64,
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
