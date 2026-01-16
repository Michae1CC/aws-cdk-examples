import * as cdk from "aws-cdk-lib/core";
import { 
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_elasticloadbalancingv2_targets as elbv2_targets,
  aws_lambda_nodejs as lambdaJs,
  aws_lambda as lambda,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

interface ApiStackProps extends StackProps {
  vpc: ec2.Vpc,
}

export class ApiStack extends cdk.Stack {
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly loadBalancerListener: elbv2.ApplicationListener;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const handler = new lambdaJs.NodejsFunction(this, "serviceLambda", {
      memorySize: 256,
      runtime: lambda.Runtime.NODEJS_24_X,
      bundling: {
        sourceMap: true,
      },
      entry: path.join(__dirname, "..", "lambda", "handler.ts"),
      handler: "handler",
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, "private-alb-sg", {
        vpc: props.vpc,
        allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTPS, "Allow HTTPS from any Ipv4 address");

    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTP, "Allow HTTP from any Ipv4 address");

    albSecurityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.icmpPing(),
        "Allow ICMP pings from any Ipv4 address",
    );

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(
      this,
      "internalApplicationLoadBalancer",
      {
        vpc: props.vpc,
        internetFacing: true,
        ipAddressType: elbv2.IpAddressType.IPV4,
        securityGroup: albSecurityGroup,
        http2Enabled: true,
      }
    );

    /**
     * Create a target group for each lambda. Note that port and protocols settings
     * are not applicable for target groups with a target type of lambda and that
     * each target group can only have a maximum of one lambda as a target.
     */
    const routeTargetGroup = new elbv2.ApplicationTargetGroup(this, "lambda-target-group", {
        vpc: props.vpc,
        targetType: elbv2.TargetType.LAMBDA,
        healthCheck: {
            // Healthchecks are not applicable for lambda target types
            enabled: false,
        },
        // Note that the {@link elbv2_targets.LambdaTarget} construct will add
        // permissions for the lambda to be invoked by the private alb
        targets: [new elbv2_targets.LambdaTarget(handler)],
    });

    this.loadBalancerListener = this.loadBalancer.addListener("http-listener", {
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultAction: elbv2.ListenerAction.forward([routeTargetGroup]),
    });
  }
}
