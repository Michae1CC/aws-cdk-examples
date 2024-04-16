import * as cdk from "aws-cdk-lib";
import {
  aws_apigatewayv2 as apigatewayv2,
  aws_apigatewayv2_integrations as apigatewayv2_integrations,
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_dynamodb as dynamodb,
} from "aws-cdk-lib";
import { Construct } from "constructs";

const HTTPS_PORT = 443;
const HTTP_PORT = 80;

interface ApiGatewayStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  flagTable: dynamodb.Table;
  applicationLoadBalancer: elbv2.IApplicationLoadBalancer;
  albSecurityGroup: ec2.ISecurityGroup;
  lambdaListener: elbv2.IApplicationListener;
}

export class ApiGatewayStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const httpApiGateway = new apigatewayv2.HttpApi(this, "httpApiGateway", {});

    httpApiGateway.addRoutes({
      path: "/service",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2_integrations.HttpAlbIntegration(
        "albIntegration",
        props.lambdaListener
      ),
    });
  }
}
