import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import { DockerImageFunction, DockerImageCode } from "aws-cdk-lib/aws-lambda";
import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import { join } from "path";

export class LambdaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // lambda function
    const myLambda = new DockerImageFunction(this, "LambdaService", {
      code: DockerImageCode.fromImageAsset(join(__dirname, "../server/lambda")),
    });

    const api = new LambdaRestApi(this, "LambdaAPI", {
      restApiName: "ApigwLambda",
      description: "Integration between apigw and Lambda Service",
      handler: myLambda,
    });

    new CfnOutput(this, "LambdaAPIGatewayUrl", {
      description: "API Gateway URL for lambda",
      value: api.url!,
    });
  }
}
