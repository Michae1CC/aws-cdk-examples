import {
  aws_iam as iam,
  aws_lambda_nodejs as lambdaJs,
  aws_lambda as lambda,
} from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

export interface DsRecordValueProps {
  /**
   * The hostZoneId containing the KSK.
   */
  readonly hostedZoneId: string;
  /**
   * The resource name of the KSK.
   */
  readonly keySigningKeyName: string;
}

/**
 * Gets a string representation of the DsRecord corresponding to a KSK
 * created within a hosted zone.
 */
export class DsRecordValue extends Construct {
  /**
   * The CloudFormation resource type.
   */
  public static readonly RESOURCE_TYPE = "Custom::AWSCDK-TokenGenerator";

  private _resource: cdk.CustomResource;

  constructor(scope: Construct, id: string, props: DsRecordValueProps) {
    super(scope, id);

    const provider = this.createProvider();

    this._resource = new cdk.CustomResource(
      this,
      "GenerateTokenGeneratorResource",
      {
        resourceType: DsRecordValue.RESOURCE_TYPE,
        serviceToken: provider.serviceToken,
        properties: {
          hostedZoneId: props.hostedZoneId,
          keySigningKeyName: props.keySigningKeyName,
        },
      }
    );
  }

  private createProvider(): cdk.custom_resources.Provider {
    const handler = new lambdaJs.NodejsFunction(this, "dsRecordValueLambda", {
      memorySize: 256,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      bundling: {
        sourceMap: true,
      },
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
      },
      description: "Generates a secure random string",
      entry: path.join(
        __dirname,
        "..",
        "lambda",
        "ds-custom-resource",
        "lambda.ts"
      ),
      handler: "handler",
    });

    handler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["route53:GetDNSSEC"],
        resources: ["*"],
      })
    );

    const provider = new cdk.custom_resources.Provider(
      this,
      "GenerateStringProvider",
      {
        onEventHandler: handler,
      }
    );

    return provider;
  }

  public get dsRecordValue(): string {
    return cdk.Token.asString(this._resource.getAtt("dsRecordValue"));
  }
}
