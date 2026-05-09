import {
  aws_certificatemanager as acm,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_iam as iam,
  aws_elasticloadbalancingv2 as elbv2,
  aws_elasticloadbalancingv2_targets as elbv2_targets,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_route53 as route53,
  aws_vpclattice as vpclattice,
  CfnOutput,
  CustomResource,
  Duration,
  Stack,
  StackProps,
  RemovalPolicy,
} from "aws-cdk-lib";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { join } from "path";

interface ServiceStackProps extends StackProps {
  hostedZone: route53.IHostedZone;
}

const VPC_CIDR = "10.0.0.0/16" as const;

export class ServiceStack extends Stack {
  public readonly nlbEndpointService: ec2.VpcEndpointService;

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

    const serviceLambda = new lambda.Function(this, "service-lambda", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('VPC Lattice Event:', JSON.stringify(event, null, 2));
          
          return {
            statusCode: 200,
            statusDescription: '200 OK',
            isBase64Encoded: false,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: 'Hello from Lambda via VPC Lattice!',
              path: event.path,
              method: event.method
            })
          };
        };
      `),
      timeout: Duration.seconds(30),
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
     * An vpc lattice lambda target group.
     */
    const lambdaTargetGroup = new vpclattice.CfnTargetGroup(
      this,
      "vpc-lattice-service-lambda-target-group",
      {
        type: "LAMBDA",
        name: "service-lambda-target-group",
        config: {
          lambdaEventStructureVersion: "V2",
        },
        targets: [
          {
            id: serviceLambda.functionArn,
          },
        ],
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
        forward: {
          targetGroups: [
            {
              targetGroupIdentifier: lambdaTargetGroup.attrId,
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
                targetGroupIdentifier: lambdaTargetGroup.attrId,
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

    // Associate the service vpc to the vpc lattice network.
    new vpclattice.CfnServiceNetworkVpcAssociation(
      this,
      "client-vpc-service-network-association",
      {
        serviceNetworkIdentifier: latticeServiceNetwork.attrId,
        vpcIdentifier: vpc.vpcId,
      },
    );

    const ecsSecurityGroup = new ec2.SecurityGroup(this, "ecs-sg", {
      vpc: vpc,
      allowAllOutbound: true,
    });

    const ecsTaskLogGroup = new logs.LogGroup(this, "ecs-task", {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

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
        runtimePlatform: {
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
        },
      },
    );

    taskDefinition.addContainer("nginx", {
      essential: true,
      containerName: "nginx",
      image: ecs.ContainerImage.fromAsset(join(__dirname, "..", "docker")),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "ecs",
        logGroup: ecsTaskLogGroup,
        mode: ecs.AwsLogDriverMode.NON_BLOCKING,
      }),
      portMappings: [
        {
          containerPort: 80,
          protocol: ecs.Protocol.TCP,
        },
      ],
    });

    const ecsService = new ecs.FargateService(this, "service", {
      cluster: cluster,
      taskDefinition: taskDefinition,
      assignPublicIp: false,
      securityGroups: [ecsSecurityGroup],
      desiredCount: 1,
      circuitBreaker: {
        enable: true,
        rollback: false,
      },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    const sneSg = new ec2.SecurityGroup(this, "sne-sg", {
      vpc: vpc,
      allowAllOutbound: true,
    });

    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTP);
    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTPS);
    ecsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.icmpPing());

    sneSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow pings from any connection",
    );

    sneSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTP);

    sneSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTPS);

    // // Create the service network endpoint
    // //
    // // NOTE: The endpoint will provide a DNS host name to access the service,
    // //  see: https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-access-service-networks.html#sn-endpoint-dns
    // const serviceNetworkEndpoint = new ec2.CfnVPCEndpoint(
    //   this,
    //   "lattice-service-network-endpoint",
    //   {
    //     // Specify the VPC where the endpoint will be created
    //     vpcId: vpc.vpcId,
    //     // Automatic DNS management feature on VPC Lattice only applies to
    //     // Resource Configurations (e.g. RDS databases shared via VPC Lattice),
    //     // not to VPC Lattice services
    //     dnsOptions: undefined,
    //     // This VPC only supports ipv4
    //     ipAddressType: ec2.IpAddressType.IPV4,
    //     // Set the endpoint type to ServiceNetwork for VPC Lattice
    //     vpcEndpointType: ec2.VpcEndpointType.SERVICENETWORK,
    //     // Specify your service network ARN
    //     serviceNetworkArn: latticeServiceNetwork.attrArn,
    //     // Specify the subnets where endpoint network interfaces will be created
    //     subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),
    //     // Specify security groups to control access to the endpoint
    //     securityGroupIds: [sneSg.securityGroupId],
    //     // Enable private DNS to access services using their private DNS names
    //     privateDnsEnabled: true,
    //   },
    // );

    // // aws ec2 describe-vpc-endpoint-associations --region=ap-southeast-2 --vpc-endpoint-ids vpce-0e769ab91dcb10b19 --query 'VpcEndpointAssociations[0].DnsEntry.DnsName' --output text
    // // https://github.com/aws/aws-cdk/tree/v1-main/packages/@aws-cdk/custom-resources#custom-resources-for-aws-apis
    // // https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_DescribeVpcEndpointAssociations.html
    // const awsCustomResource = new cr.AwsCustomResource(
    //   this,
    //   "service-endpoint-dns-name-cr",
    //   {
    //     onCreate: {
    //       service: "EC2",
    //       action: "describeVpcEndpointAssociations",
    //       parameters: {
    //         Region: this.region,
    //         VpcEndpointIds: ["vpce-0e769ab91dcb10b19"],
    //       },
    //       physicalResourceId: cr.PhysicalResourceId.of(
    //         `describe-vpc-endpoint-associations-${Date.now()}`,
    //       ),
    //     },
    //     onUpdate: {
    //       service: "EC2",
    //       action: "describeVpcEndpointAssociations",
    //       parameters: {
    //         Region: this.region,
    //         VpcEndpointIds: ["vpce-0e769ab91dcb10b19"],
    //       },
    //       physicalResourceId: cr.PhysicalResourceId.of(
    //         `describe-vpc-endpoint-associations-${Date.now()}`,
    //       ),
    //     },
    //     policy: cr.AwsCustomResourcePolicy.fromStatements([
    //       new iam.PolicyStatement({
    //         effect: iam.Effect.ALLOW,
    //         actions: ["ec2:DescribeVpcEndpointAssociations"],
    //         resources: ["*"],
    //       }),
    //     ]),
    //     logRetention: logs.RetentionDays.ONE_WEEK,
    //     timeout: Duration.minutes(5),
    //   },
    // );

    // new CfnOutput(this, "test-output", {
    //   value: awsCustomResource.getResponseField(
    //     "VpcEndpointAssociations.0.DnsEntry.DnsName",
    //   ),
    // });

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
    const serviceNlb = new elbv2.NetworkLoadBalancer(
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
      "http-nlb-target-group",
      {
        vpc: vpc,
        port: 80,
        protocol: elbv2.Protocol.TCP,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          enabled: true,
          protocol: elbv2.Protocol.HTTP,
          port: "80",
          path: "/",
          healthyHttpCodes: "200,202",
        },
      },
    );

    nlbTargetGroup.addTarget(ecsService);

    // Add listener to NLB
    const serviceNlbListener = serviceNlb.addListener("nlb-listener", {
      port: 80,
      protocol: elbv2.Protocol.TCP,
      defaultTargetGroups: [nlbTargetGroup],
    });

    this.nlbEndpointService = new ec2.VpcEndpointService(
      this,
      "nlb-endpoint-service",
      {
        vpcEndpointServiceLoadBalancers: [serviceNlb],
        acceptanceRequired: false,
        allowedPrincipals: [new iam.AccountPrincipal(this.account)],
        allowedRegions: ["ap-southeast-2", "us-east-1"],
        supportedIpAddressTypes: [ec2.IpAddressType.IPV4],
      },
    );

    new route53.VpcEndpointServiceDomainName(
      this,
      "nlb-endpoint-service-domain-name",
      {
        endpointService: this.nlbEndpointService,
        domainName: domainName,
        publicHostedZone: props.hostedZone,
      },
    );

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
