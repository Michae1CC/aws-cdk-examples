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

    /**
     * Traffic originating from the api-gateway is tunnelled into the vpc
     * via a vpc link. This vpc link is injected into the vpc through an
     * elastic network interface (ENI). Security groups need to be configured
     * on the ENI to communicate with other resources
     * within the vpc. From the perspective of the vpc link's ENI, traffic is
     * routed out to other resources in the vpc. Since security groups are
     * stateful this is why we only need egress rules for tcp traffic.
     */
    const vpcLinkSecurityGroup = new ec2.SecurityGroup(
      this,
      "albSecurityGroup",
      {
        vpc: props.vpc,
        allowAllOutbound: true,
      }
    );

    vpcLinkSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv4"
    );

    vpcLinkSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.icmpPing(),
      "Allow Pings from Ipv6"
    );

    httpApiGateway.addRoutes({
      path: "/service",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2_integrations.HttpAlbIntegration(
        "albIntegration",
        props.lambdaListener,
        {
          vpcLink: new apigatewayv2.VpcLink(this, "albVpcLink", {
            vpc: props.vpc,
            securityGroups: [vpcLinkSecurityGroup],
          }),
        }
      ),
    });
  }
}
