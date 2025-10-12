import { aws_secretsmanager as secretsmanager } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class SecretsStack extends cdk.Stack {
  public readonly ipsecKeySecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.ipsecKeySecret = new secretsmanager.Secret(this, "ipsec-key-secret", {
      description:
        "The pre-shared key used in the IPsec site-to-site VPN tunnel",
      generateSecretString: {
        excludeCharacters: '"@/\\',
        generateStringKey: "psk",
        secretStringTemplate: "{}",
      },
    });
  }
}
