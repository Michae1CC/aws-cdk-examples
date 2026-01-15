import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  aws_certificatemanager as acm,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_route53 as route53,
  aws_route53_targets as route53_targets,
} from "aws-cdk-lib";
import * as path from "path";

interface ServiceStackProps extends cdk.StackProps {
  hostedZone: route53.IHostedZone;
}

export class ServiceStack extends cdk.Stack {
  public readonly privateAlb: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    /**
     * Create a VPC that occupies two AZs and has both a public and private
     * subnet. The NAT GWs are using for fargate instances within the private
     * subnet to discover/pull from ECR.
     */
    const vpc = new ec2.Vpc(this, "vpc", {
      natGateways: 2,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "public-subnet",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "private-subnet",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    /**
     * The security group for our ALB should allow in coming traffic for HTTP,
     * HTTPS and ICMP from and source. It should also allow out going
     * connections to our fargate service.
     */
    const albSecurityGroup = new ec2.SecurityGroup(this, "alb-sg", {
      vpc: vpc,
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv6"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTP,
      "Allow HTTP traffic from Ipv4"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.HTTP,
      "Allow HTTP from Ipv6"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTPS,
      "Allow HTTPS traffic from Ipv4"
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.HTTPS,
      "Allow HTTPS from Ipv6"
    );

    /**
     * Our fargate security group should only allow incoming HTTPS requests
     * from our ALB. We will also any ICMP pings for diagnostic purposes, this
     * should be fine since our fargate service is not publicly accessible.
     */
    const serviceSecurityGroup = new ec2.SecurityGroup(
      this,
      "serviceSecurityGroup",
      {
        vpc: vpc,
        allowAllOutbound: true,
      }
    );

    albSecurityGroup.addEgressRule(serviceSecurityGroup, ec2.Port.HTTPS);

    serviceSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4"
    );

    serviceSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv6"
    );

    serviceSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(8080),
      "Allow HTTP from the private ALB to the express app port"
    );

    const cluster = new ecs.Cluster(this, "ecs-cluster", {
      vpc: vpc,
    });

    // Role name must start with 'ecsInstanceRole' to match the PassRole permission
    // in AmazonECSInfrastructureRolePolicyForManagedInstances managed policy
    const ecsInstanceRole = new iam.Role(this, "ecs-instance-role", {
      roleName: `ecsInstanceRole-ecs-service`,
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        // Default policy for the Amazon EC2 Role for Amazon EC2 Container Service.
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonEC2ContainerServiceforEC2Role"
        ),
      ],
    });

    const instanceProfile = new iam.InstanceProfile(this, "instance-profile", {
      role: ecsInstanceRole,
    });

    // Infrastructure role for ECS Managed Instances
    const infrastructureRole = new iam.Role(this, "ecs-infrastructure-role", {
      assumedBy: new iam.ServicePrincipal("ecs.amazonaws.com"),
      managedPolicies: [
        // Grants the permissions required by Amazon ECS to create and update
        // Amazon EC2 resources for ECS Managed Instances on your behalf, see:
        // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-iam-awsmanpol.html
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonECSInfrastructureRolePolicyForManagedInstances"
        ),
      ],
    });

    const managedInstanceCapacityProvider =
      new ecs.ManagedInstancesCapacityProvider(
        this,
        "managed-instance-capacity-provider",
        {
          ec2InstanceProfile: instanceProfile,
          subnets: vpc.privateSubnets,
          instanceRequirements: {
            vCpuCountMin: 1,
            memoryMin: cdk.Size.gibibytes(1),
            cpuManufacturers: [ec2.CpuManufacturer.AMD],
          },
          securityGroups: [serviceSecurityGroup],
        }
      );

    cluster.addManagedInstancesCapacityProvider(
      managedInstanceCapacityProvider
    );

    const taskDefinition = new ecs.TaskDefinition(this, "task-definition", {
      memoryMiB: "512",
      cpu: "256",
      networkMode: ecs.NetworkMode.AWS_VPC,
      compatibility: ecs.Compatibility.MANAGED_INSTANCES,
    });

    taskDefinition.addContainer("app", {
      essential: true,
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, "..", "docker")),
      // Since we are using Fargate for our ECS service, the
      // service will run in an awsvpc network mode. The port
      // serving content from the container will be the same as the
      // host container port.
      portMappings: [
        {
          containerPort: 8080,
        },
      ],
    });

    const ecsService = new ecs.FargateService(this, "app-service", {
      cluster: cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
      vpcSubnets: {
        // Place the tasks into subnets with connectivity to a NAT GW
        // to pull images through
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      assignPublicIp: false,
      availabilityZoneRebalancing: ecs.AvailabilityZoneRebalancing.ENABLED,
      securityGroups: [serviceSecurityGroup],
      capacityProviderStrategies: [
        {
          capacityProvider:
            managedInstanceCapacityProvider.capacityProviderName,
          weight: 1,
        },
      ],
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    this.privateAlb = new elbv2.ApplicationLoadBalancer(this, "private-alb", {
      vpc: vpc,
      vpcSubnets: {
        // Inject this alb into private subnets, this is required for it
        // to be used as a Cloudfront Distribution VPC origin, see:
        //  https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-vpc-origins.html
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      internetFacing: false,
      ipAddressType: elbv2.IpAddressType.IPV4,
      securityGroup: albSecurityGroup,
      http2Enabled: true,
      dropInvalidHeaderFields: false,
      // Append the client IP address of the last hop (in this case the
      // cloudfront distribution) to the X-Forwarded-For header for debugging
      xffHeaderProcessingMode: elbv2.XffHeaderProcessingMode.APPEND,
      // Preserve the source port the client used to connect to the alb
      // in the X-Forwarded-For header for debugging
      preserveXffClientPort: true,
    });

    new route53.ARecord(this, "private-alb-a-record", {
      zone: props.hostedZone,
      recordName: "alb.michael.polymathian.dev",
      target: route53.RecordTarget.fromAlias(
        new route53_targets.LoadBalancerTarget(this.privateAlb)
      ),
    });

    const privateLoadBalancerCertificate = new acm.Certificate(
      this,
      "private-alb-certificate",
      {
        domainName: "alb.michael.polymathian.dev",
        validation: acm.CertificateValidation.fromDns(props.hostedZone),
      }
    );

    const authServerTargetGroup = new elbv2.ApplicationTargetGroup(
      this,
      "auth-server-target-group",
      {
        vpc: vpc,
        port: 8080,
        protocol: elbv2.ApplicationProtocol.HTTP,
        healthCheck: {
          protocol: elbv2.Protocol.HTTP,
          path: "/healthcheck",
        },
      }
    );

    authServerTargetGroup.addTarget(ecsService);

    const httpsListener = this.privateAlb.addListener("https-listener", {
      port: 443,
      open: false,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/plain",
        messageBody: "404 ALB No Rule",
      }),
      certificates: [privateLoadBalancerCertificate],
    });

    new elbv2.ApplicationListenerRule(this, "match-domain-rule", {
      listener: httpsListener,
      conditions: [
        elbv2.ListenerCondition.hostHeaders(["michael.polymathian.dev"]),
        elbv2.ListenerCondition.pathPatterns(["/api"]),
      ],
      action: elbv2.ListenerAction.forward([authServerTargetGroup]),
      // This value must be globally unique within the context on this alb.
      priority: 1,
    });
  }
}
