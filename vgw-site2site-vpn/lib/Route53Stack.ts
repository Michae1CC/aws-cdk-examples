import { aws_ec2 as ec2 } from "aws-cdk-lib";
import { aws_route53resolver as route53resolver } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface Route53StackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class Route53Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Route53StackProps) {
    super(scope, id, props);

    const resolverEndpointSg = new ec2.SecurityGroup(
      this,
      "resolver-endpoint-sg",
      {
        vpc: props.vpc,
        allowAllOutbound: true,
      }
    );

    resolverEndpointSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allTraffic()
    );

    const dnsResolverOutboundEndpoint = new route53resolver.CfnResolverEndpoint(
      this,
      "dns-resolver-outbound-endpoint",
      {
        direction: "OUTBOUND",
        // Even though the minimum is 1, Route 53 requires that you create at least two,
        // see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_route53resolver.CfnResolverEndpoint.html#ipaddresses
        ipAddresses: props.vpc
          .selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS })
          .subnetIds.map((subnetId) => ({
            subnetId: subnetId,
          })),
        securityGroupIds: [resolverEndpointSg.securityGroupId],
        resolverEndpointType: "IPV4",
      }
    );
  }
}
