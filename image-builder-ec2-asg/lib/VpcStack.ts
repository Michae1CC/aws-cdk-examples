import { aws_ec2 as ec2, StackProps } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as yaml from "yaml";

interface Props extends StackProps {}

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "vpc", {
      ipProtocol: ec2.IpProtocol.IPV4_ONLY,
      maxAzs: 2,
      natGateways: 1,
      createInternetGateway: true,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Create VPC endpoints for SSM (required for private subnet access)
    // const ssmEndpoint = new ec2.InterfaceVpcEndpoint(
    //   this,
    //   "ssm-interface-endpoint",
    //   {
    //     vpc: this.vpc,
    //     service: ec2.InterfaceVpcEndpointAwsService.SSM,
    //     subnets: {
    //       subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //     },
    //   },
    // );

    // const ssmMessagesEndpoint = new ec2.InterfaceVpcEndpoint(
    //   this,
    //   "ssm-messages-endpoint",
    //   {
    //     vpc: this.vpc,
    //     service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
    //     subnets: {
    //       subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //     },
    //   },
    // );

    // const ec2MessagesEndpoint = new ec2.InterfaceVpcEndpoint(
    //   this,
    //   "ec2-messages-endpoint",
    //   {
    //     vpc: this.vpc,
    //     service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
    //     subnets: {
    //       subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    //     },
    //   },
    // );
  }
}
