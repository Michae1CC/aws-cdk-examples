import {
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
  Duration,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface Props extends StackProps {
  vpc: ec2.Vpc;
}

export class RdsStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    // Templated secret with username and password fields
    const templatedSecret = new secretsmanager.Secret(this, "TemplatedSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "postgres" }),
        generateStringKey: "password",
        excludeCharacters: '/@"',
      },
    });

    const rdsDatabaseInstanceSg = new ec2.SecurityGroup(
      this,
      "rds-database-instance-sg",
      {
        vpc: props.vpc,
        allowAllOutbound: true,
      },
    );

    const databaseInstance = new rds.DatabaseInstance(
      this,
      "database-instance",
      {
        engine: rds.DatabaseInstanceEngine.POSTGRES,
        vpc: props.vpc,
        allocatedStorage: 10, // GiB
        allowMajorVersionUpgrade: false,
        autoMinorVersionUpgrade: true,
        credentials: {
          username: templatedSecret
            .secretValueFromJson("username")
            .unsafeUnwrap(),
          password: templatedSecret.secretValueFromJson("password"),
        },
        storageEncrypted: true,
        // Research
        cloudwatchLogsExports: [],
        performanceInsightRetention: rds.PerformanceInsightRetention.MONTHS_15,
        databaseInsightsMode: rds.DatabaseInsightsMode.ADVANCED,
        deleteAutomatedBackups: true,
        monitoringInterval: Duration.minutes(1),
        networkType: rds.NetworkType.IPV4,
        securityGroups: [rdsDatabaseInstanceSg],
      },
    );

    // No inbound rules needed — SSM connects outbound over HTTPS (443).
    const instanceSg = new ec2.SecurityGroup(this, "instance-sg", {
      vpc: props.vpc,
      allowAllOutbound: true, // required for SSM agent to reach SSM endpoints
    });

    // AmazonSSMManagedInstanceCore grants the SSM agent the permissions it needs.
    const role = new iam.Role(this, "instance-role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore",
        ),
      ],
    });

    const userData = ec2.UserData.forLinux({});
    userData.addCommands("dnf update -y", "dnf install postgresql18");

    const instance = new ec2.Instance(this, "instance", {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      // Amazon Linux 2023 ships with SSM Agent pre-installed.
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: instanceSg,
      role,
      // Grants Session Manager permissions and wires up the instance profile.
      ssmSessionPermissions: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      // Require IMDSv2 (security best practice).
      requireImdsv2: true,
    });

    // Allow the instance security group to connect to the database
    rdsDatabaseInstanceSg.addIngressRule(instanceSg, ec2.Port.tcp(5432));
  }
}
