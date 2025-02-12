import {
  aws_codedeploy as codedeploy,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_ecr as ecr,
  aws_elasticloadbalancingv2 as elbv2,
  aws_logs as logs,
  aws_route53 as route53,
  Stack,
  StackProps,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from "constructs";

const APP_PORT = 8080 as const;

export class AppStack extends Stack {
  public readonly appEcrRepository: ecr.Repository;
  public readonly vpc: ec2.Vpc;
  public readonly deploymentGroup: codedeploy.EcsDeploymentGroup;
  public readonly appLoadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /**
     * An ECR repository to store images for the application
     */
    this.appEcrRepository = new ecr.Repository(this, "app", {
      emptyOnDelete: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /**
     * Create a vpc for the application
     */
    this.vpc = new ec2.Vpc(this, "vpc", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 3,
      natGateways: 1,
      enableDnsSupport: true,
      enableDnsHostnames: true,
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

    /**
     * Create a SG for the application service
     */
    const serviceSecurityGroup = new ec2.SecurityGroup(this, "service-sg", {
      vpc: this.vpc,
      allowAllOutbound: true,
    });

    /**
     * Create an SG for the public alb
     */
    const albSecurityGroup = new ec2.SecurityGroup(this, "public-alb-sg", {
      vpc: this.vpc,
      allowAllOutbound: true,
    });

    /**
     * Create a SG for the database
     */
    const databaseSecurityGroup = new ec2.SecurityGroup(this, "database-sg", {
      vpc: this.vpc,
      allowAllOutbound: true,
    });

    serviceSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(APP_PORT),
      "Allow HTTP from the public ALB",
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allIcmp(),
      "Allow ICMP pings from Ipv4 on any port",
    );
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP from any port",
    );
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8080),
      "Allow HTTP from any port",
    );

    databaseSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow ICMP pings from Ipv4 on any port",
    );
    databaseSecurityGroup.addIngressRule(
      serviceSecurityGroup,
      ec2.Port.allTcp(),
    );

    /**
     * A small instance to run the example application PG database
     */
    const dbInstance = new ec2.Instance(this, "databaseInstance", {
      vpc: this.vpc,
      allowAllOutbound: true,
      associatePublicIpAddress: true,
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
      securityGroup: databaseSecurityGroup,
    });

    dbInstance.addUserData(
      "sudo yum update -y",
      "sudo yum install -y docker",
      "sudo service docker start",
      "sudo usermod -a -G docker ec2-user",
      "sudo docker pull postgres",
      "sudo docker run -d --rm --env POSTGRES_PASSWORD=webapp --env POSTGRES_USER=webapp -p 5432:5432 postgres",
    );

    /**
     * Create a private hostzone to create private DNS records for the DB
     * instance
     */
    const privateHostedZone = new route53.PrivateHostedZone(
      this,
      "privateHostedZone",
      {
        vpc: this.vpc,
        zoneName: "database.com",
      },
    );

    // Create an A Record within our private hosted zone to point to the
    // database instance.
    new route53.ARecord(this, "databaseARecord", {
      zone: privateHostedZone,
      target: route53.RecordTarget.fromIpAddresses(
        dbInstance.instancePrivateIp,
      ),
    });

    /**
     * Create a new cluster for the ECS service.
     */
    const appCluster = new ecs.Cluster(this, "cluster", {
      vpc: this.vpc,
      enableFargateCapacityProviders: true,
    });

    appCluster.addDefaultCapacityProviderStrategy([
      {
        capacityProvider: "FARGATE",
        // Direct all the traffic in this cluster to Fargate
        weight: 1,
      },
    ]);

    /**
     * Create a log group for the application ECS service
     */
    const appLogGroup = new logs.LogGroup(this, "app-log-group", {
      retention: logs.RetentionDays.THREE_DAYS,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /**
     * Create an ECS task definition for the example service
     */
    const appTaskDefinition = new ecs.FargateTaskDefinition(
      this,
      "task-definition",
      {
        // Use the minimum allowable cpu and memory usage.
        cpu: 256,
        memoryLimitMiB: 512,
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
      },
    );

    // Add the latest image from the service ECR repo as the primary container
    // for the service
    appTaskDefinition.addContainer("service-container", {
      // This container is required to be running for the auth server
      // service to be considered healthy.
      essential: true,
      image: ecs.ContainerImage.fromEcrRepository(this.appEcrRepository),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "ecs",
        logGroup: appLogGroup,
        mode: ecs.AwsLogDriverMode.NON_BLOCKING,
      }),
      portMappings: [{ containerPort: APP_PORT }],
      environment: {
        POSTGRES_HOSTNAME: "database.com",
        PROD: "1",
      },
    });

    /**
     * Create a fargate service to run our example app
     */
    const appService = new ecs.FargateService(this, "auth-service", {
      cluster: appCluster,
      taskDefinition: appTaskDefinition,
      vpcSubnets: {
        subnets: this.vpc.privateSubnets,
      },
      deploymentController: {
        type: ecs.DeploymentControllerType.CODE_DEPLOY,
      },
      assignPublicIp: false,
      securityGroups: [serviceSecurityGroup],
      desiredCount: 1,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    this.appLoadBalancer = new elbv2.ApplicationLoadBalancer(
      this,
      "public-alb",
      {
        vpc: this.vpc,
        internetFacing: true,
        ipAddressType: elbv2.IpAddressType.IPV4,
        securityGroup: albSecurityGroup,
        http2Enabled: true,
      },
    );

    const appBlueGreenTargetGroup1 = new elbv2.ApplicationTargetGroup(
      this,
      "app-blue-green-target-group-1",
      {
        vpc: this.vpc,
        port: APP_PORT,
        protocol: elbv2.ApplicationProtocol.HTTP,
        // When using AWS VPC mode, the target type for a load balancer
        // should be set to "ip" because in this mode, you are registering
        // targets based on their IP addresses, not instance IDs, as each
        // container within a VPC will have its own Elastic Network Interface
        // (ENI) with a unique IP address; essentially, you are targeting the
        // IP address directly instead of the underlying EC2 instance
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          protocol: elbv2.Protocol.HTTP,
          path: "/healthcheck",
        },
      },
    );

    appBlueGreenTargetGroup1.addTarget(appService);

    const appBlueGreenTargetGroup2 = new elbv2.ApplicationTargetGroup(
      this,
      "app-blue-green-target-group-2",
      {
        vpc: this.vpc,
        port: APP_PORT,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          protocol: elbv2.Protocol.HTTP,
          path: "/healthcheck",
        },
      },
    );

    /**
     * Create a listener for production traffic
     */
    const httpProductionListener = this.appLoadBalancer.addListener(
      "http-blue-green-listener-1",
      {
        port: 80,
        // We are already providing a custom security group to the alb with
        // the appropriate rules set. Set this flag to false to prevent
        // additional rules from being included which open the security group
        // to all addresses.
        open: false,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultAction: elbv2.ListenerAction.fixedResponse(404, {
          contentType: "text/plain",
          messageBody: "404 ALB No Rule",
        }),
      },
    );

    httpProductionListener.addTargetGroups("add-blue-green-target-group-1", {
      targetGroups: [appBlueGreenTargetGroup1],
    });

    const httpTestListener = this.appLoadBalancer.addListener(
      "http-blue-green-listener-2",
      {
        port: 8080,
        // We are already providing a custom security group to the alb with
        // the appropriate rules set. Set this flag to false to prevent
        // additional rules from being included which open the security group
        // to all addresses.
        open: false,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultAction: elbv2.ListenerAction.fixedResponse(404, {
          contentType: "text/plain",
          messageBody: "404 ALB No Rule",
        }),
      },
    );

    httpTestListener.addTargetGroups("add-blue-green-target-group-2", {
      targetGroups: [appBlueGreenTargetGroup1],
    });

    /**
     * Create a listener for test traffic
     */
    this.deploymentGroup = new codedeploy.EcsDeploymentGroup(
      this,
      "app-deployment-group",
      {
        service: appService,
        blueGreenDeploymentConfig: {
          blueTargetGroup: appBlueGreenTargetGroup1,
          greenTargetGroup: appBlueGreenTargetGroup2,
          listener: httpProductionListener,
          testListener: httpTestListener,
        },
      },
    );
  }
}
