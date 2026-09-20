import {
  aws_ec2 as ec2,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
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
          username: templatedSecret.secretValueFromJson("username").toString(),
          password: templatedSecret.secretValueFromJson("password"),
        },
        // Research
        cloudwatchLogsExports: [],
        databaseInsightsMode: rds.DatabaseInsightsMode.ADVANCED,
        deleteAutomatedBackups: true,
      },
    );
  }
}
