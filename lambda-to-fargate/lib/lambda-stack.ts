import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import { DockerImageFunction, DockerImageCode } from "aws-cdk-lib/aws-lambda";
import { HttpApi, HttpMethod } from "@aws-cdk/aws-apigatewayv2-alpha";
import { HttpLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";
import { join } from "path";

export class LambdaStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // lambda function
    const myLambda = new DockerImageFunction(this, "LambdaService", {
      code: DockerImageCode.fromImageAsset(join(__dirname, "../server/lambda")),
    });

    const api = new HttpApi(this, "LambdaAPI");
    const getLambdaIntegration = new HttpLambdaIntegration("getLambdaProxy", myLambda);
    
    api.addRoutes({
      path: '/{proxy+}', // Adding {proxy+} catches all paths
      methods: [HttpMethod.GET],
      integration: getLambdaIntegration
    });
    
    new CfnOutput(this, "LambdaAPIGatewayUrl", {
      description: "API Gateway URL for lambda",
      value: api.url!,
    });
  }
}
