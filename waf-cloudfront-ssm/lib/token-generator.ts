import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import * as path from "path";

/**
 * Properties for the TokenGenerator construct.
 */
export interface TokenGeneratorProps {
  /**
   * The length of the random string to generate. If no length is given a
   * default length of 64 is used.
   */
  readonly length?: number;
}

/**
 * Creates a random string using a hexadecimal character set.
 * The string generated is cryptographically strong and is suitable
 * for managing data such as passwords, account authentication, security
 * tokens, and related secrets.
 */
export class TokenGenerator extends Construct {
  /**
   * The CloudFormation resource type.
   */
  public static readonly RESOURCE_TYPE = "Custom::AWSCDK-TokenGenerator";

  /**
   * The default string length.
   */
  public static readonly DEFAULT_STRING_LENGTH = 64;

  private _resource: cdk.CustomResource;

  constructor(scope: Construct, id: string, props: TokenGeneratorProps) {
    super(scope, id);

    // Lambda payload has a limit of 6MB. Only allow up to 5MB for the
    // string
    const maxLength = 5 * 1000 * 1000;
    if (props.length && (props.length <= 0 || props.length > maxLength)) {
      throw new Error(
        "The random string length must be within range 0 <= length < 5,000,000."
      );
    }

    const provider = this.createProvider();

    this._resource = new cdk.CustomResource(
      this,
      "GenerateTokenGeneratorResource",
      {
        resourceType: TokenGenerator.RESOURCE_TYPE,
        serviceToken: provider.serviceToken,
        properties: {
          StringLength: props.length ?? TokenGenerator.DEFAULT_STRING_LENGTH,
        },
      }
    );
  }

  private createProvider(): cdk.custom_resources.Provider {
    const handler = new Function(this, "TokenGeneratorGenerator", {
      runtime: Runtime.PYTHON_3_11,
      handler: "index.handler",
      memorySize: 256,
      timeout: cdk.Duration.minutes(5),
      description: "Generates a secure random string",
      code: Code.fromAsset(path.join(__dirname, "token-generator-lambda")),
    });

    const provider = new cdk.custom_resources.Provider(
      this,
      "GenerateStringProvider",
      {
        onEventHandler: handler,
      }
    );

    return provider;
  }

  public get value(): string {
    return cdk.Token.asString(this._resource.getAtt("Value"));
  }
}
