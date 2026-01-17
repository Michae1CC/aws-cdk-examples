import * as cdk from "aws-cdk-lib/core";
import {
  aws_apigateway as apigateway,
  aws_apigatewayv2 as apigatewayv2,
  aws_apigatewayv2_integrations as apigatewayv2_integrations,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_s3 as s3,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface ApiGatewayStackProps extends StackProps {
  staticSiteBucket: s3.IBucket;
  loadBalancer: elbv2.ApplicationLoadBalancer;
  // loadBalancerListener: elbv2.ApplicationListener;
  // vpc: ec2.Vpc,
}

export class ApiGatewayStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const apigwRole = new iam.Role(this, "api-gateway-role", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonAPIGatewayPushToCloudWatchLogs"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
      ],
    });

    /**
     * API Gateway creation
     */
    const restApi = new apigateway.RestApi(this, "api-gateway", {
      binaryMediaTypes: ["image/*"],
      // Automatically perform a deployment for this API when
      // the API model (resources, methods) changes
      deploy: true,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
      // endpointConfiguration: {
      //   types: [apigateway.EndpointType.REGIONAL],
      // },
    });

    const apiGatewayRoot = restApi.root;
    const apiResource = apiGatewayRoot.addResource("api");
    const imageResource = apiGatewayRoot.addResource("images");
    const objectResource = apiGatewayRoot.addResource("{proxy+}");

    const s3IndexIntegration = new apigateway.AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      path: `${props.staticSiteBucket.bucketName}/index.html`,
      options: {
        credentialsRole: apigwRole,
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

    apiGatewayRoot.addMethod("GET", s3IndexIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Content-Type": true,
          },
        },
      ],
    });

    const s3ImageIntegration = new apigateway.AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      path: `${props.staticSiteBucket.bucketName}/images/{proxy}`,
      options: {
        credentialsRole: apigwRole,
        requestParameters: {
          "integration.request.path.proxy": "method.request.path.proxy",
        },
        integrationResponses: [
          {
            contentHandling: apigateway.ContentHandling.CONVERT_TO_BINARY,
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

    const imageProxyResource = imageResource.addResource("{proxy+}");

    imageProxyResource.addMethod("GET", s3ImageIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      requestParameters: {
        // Set the proxy parameters as required
        "method.request.path.proxy": true,
      },
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Content-Type": true,
          },
        },
      ],
    });

    const s3Integration = new apigateway.AwsIntegration({
      service: "s3",
      integrationHttpMethod: "GET",
      path: `${props.staticSiteBucket.bucketName}/{proxy}`,
      options: {
        credentialsRole: apigwRole,
        requestParameters: {
          "integration.request.path.proxy": "method.request.path.proxy",
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

    objectResource.addMethod("GET", s3Integration, {
      authorizationType: apigateway.AuthorizationType.NONE,
      requestParameters: {
        // Set the key parameters as required
        "method.request.path.proxy": true,
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

    const albIntegration = new apigateway.HttpIntegration(
      `http://${props.loadBalancer.loadBalancerDnsName}`,
      {
        httpMethod: "GET",
        proxy: true,
      }
    );

    const userApi = apiResource.addResource("users");

    userApi.addMethod("GET", albIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });
  }
}
