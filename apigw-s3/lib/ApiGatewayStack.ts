import * as cdk from "aws-cdk-lib/core";
import {
  aws_apigateway as apigateway,
  aws_apigatewayv2_integrations as apigatewayv2_integrations,
  aws_iam as iam,
  aws_s3 as s3,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface ApiGatewayStackProps extends StackProps {
  staticSiteBucket: s3.IBucket;
}

export class ApiGatewayStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const apigwRole = new iam.Role(this, "api-gateway-role", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchLogsFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
      ],
    });

    /**
     * API Gateway creation
     */
    const restApi = new apigateway.RestApi(this, "api-gateway", {
      deploy: true,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const s3Integration = new apigateway.AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      path: `${props.staticSiteBucket.bucketName}/{key}`,
      options: {
        credentialsRole: apigwRole,
        requestParameters: {
          "integration.request.path.key": "method.request.path.key",
        },
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Content-Type":
                "integration.response.header.Content-Type",
            },
          },
          {
            statusCode: "404",
            selectionPattern: "404",
          },
        ],
      },
    });

    const objectResource = restApi.root.addResource("{key}");

    objectResource.addMethod("GET", s3Integration, {
      requestParameters: {
        "method.request.path.key": true,
      },
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Content-Type": true,
          },
        },
        {
          statusCode: "404",
        },
      ],
    });

    new cdk.CfnOutput(this, "api-gateway-url", {
      value: restApi.url,
    });
  }
}
