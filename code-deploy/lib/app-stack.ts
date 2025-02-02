import {
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_route53 as route53,
  Stack,
  StackProps,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class AppStack extends Stack {
  public readonly appEcrRepository: ecr.Repository;
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.appEcrRepository = new ecr.Repository(this, "app", {
      emptyOnDelete: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.vpc = new ec2.Vpc(this, "vpc", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 3,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const privateHostedZone = new route53.PrivateHostedZone(
      this,
      "privateHostedZone",
      {
        vpc: this.vpc,
        zoneName: "database.com",
      },
    );

    const dbSg = new ec2.SecurityGroup(this, "db-sg", {
      vpc: this.vpc,
      allowAllOutbound: true,
    });

    dbSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.icmpPing());
    dbSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allTcp());

    // const dbInstance = new ec2.Instance(this, "databaseInstance", {
    //   vpc: this.vpc,
    //   allowAllOutbound: true,
    //   associatePublicIpAddress: true,
    //   instanceType: ec2.InstanceType.of(
    //     ec2.InstanceClass.T2,
    //     ec2.InstanceSize.MICRO
    //   ),
    //   machineImage: new ec2.AmazonLinuxImage({
    //     generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
    //   }),
    //   securityGroup: dbSg,
    // });

    // dbInstance.addUserData(
    //   "sudo yum update -y",
    //   "sudo yum install -y docker",
    //   "sudo service docker start",
    //   "sudo usermod -a -G docker ec2-user",
    //   "sudo docker pull postgres",
    //   "sudo docker run -d --rm --env POSTGRES_PASSWORD=webapp --env POSTGRES_USER=webapp -p 5432:5432 postgres"
    // );

    // // Create an A Record within our private hosted zone to point to the
    // // database instance.
    // new route53.ARecord(this, "databaseARecord", {
    //   zone: privateHostedZone,
    //   target: route53.RecordTarget.fromIpAddresses(
    //     dbInstance.instancePrivateIp
    //   ),
    // });
  }
}
