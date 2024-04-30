import * as cdk from "aws-cdk-lib";
import {
  aws_apigatewayv2 as apigatewayv2,
  aws_apigatewayv2_integrations as apigatewayv2_integrations,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_lambda_nodejs as lambdaJs,
  aws_lambda as lambda,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

interface AuthStackProps extends cdk.StackProps {
  flagTable: dynamodb.Table;
  httpApiGateway: apigatewayv2.HttpApi;
}

export class AuthStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    if (
      process.env.GITHUB_CLIENT_ID === undefined ||
      process.env.GITHUB_CLIENT_SECRET === undefined
    ) {
      cdk.Annotations.of(this).addError(
        "Must provide GitHub client ID and GitHub client secret."
      );
    }

    const tokenHandler = new lambdaJs.NodejsFunction(this, "tokenLambda", {
      memorySize: 256,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      bundling: {
        sourceMap: true,
      },
      entry: path.join(__dirname, "..", "lambda", "token", "lambda.ts"),
      handler: "handler",
    });

    props.httpApiGateway.addRoutes({
      path: "/access_token",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2_integrations.HttpLambdaIntegration(
        "accessTokenIntegration",
        tokenHandler
      ),
    });

    // const userPool = new cognito.UserPool(this, "serviceUserPool", {
    //   userPoolName: "serviceUserPool",
    //   mfa: cognito.Mfa.OFF,
    //   selfSignUpEnabled: false,
    //   removalPolicy: cdk.RemovalPolicy.DESTROY,
    // });

    // const githubOidcProvider = new cognito.UserPoolIdentityProviderOidc(
    //   this,
    //   "githubOidcProvider",
    //   {
    //     userPool: userPool,
    //     clientId: process.env.GITHUB_CLIENT_ID!,
    //     clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    //     issuerUrl: "https://github.com",
    //     scopes: ["openid", "user"],
    //     attributeRequestMethod: cognito.OidcAttributeRequestMethod.POST,
    //     endpoints: {
    //       authorization: "https://github.com/login/oauth/authorize",
    //       token: `${props.httpApiGateway.url}/access_token`,
    //       jwksUri: `${props.httpApiGateway.url}/access_token`,
    //       userInfo: `${props.httpApiGateway.url}/user`,
    //     },
    //   }
    // );
  }
}
