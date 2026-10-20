import {
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_vpclattice as vpclattice,
  CfnOutput,
  Duration,
  Stack,
  StackProps,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface Props extends StackProps {
  vpc: ec2.Vpc;
}

export class VpcLatticeStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    /**
     * Creates a lattice service network that the vpc will be associated with.
     */
    const latticeServiceNetwork = new vpclattice.CfnServiceNetwork(
      this,
      "vpc-lattice-service-network",
      {
        authType: "NONE",
        sharingConfig: {
          enabled: true,
        },
      },
    );

    /**
     * Create a security group used by the service network VPC association
     */
    const serviceNetworkVpcAssociationSg = new ec2.SecurityGroup(
      this,
      "sn-vpc-association-sg",
      {
        vpc: props.vpc,
        allowAllOutbound: true,
      },
    );

    serviceNetworkVpcAssociationSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      "Allow pings from any connection",
    );
    serviceNetworkVpcAssociationSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTP,
    );
    serviceNetworkVpcAssociationSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.HTTPS,
    );

    // Associate the service vpc to the vpc lattice network.
    new vpclattice.CfnServiceNetworkVpcAssociation(
      this,
      "client-vpc-service-network-association",
      {
        serviceNetworkIdentifier: latticeServiceNetwork.attrId,
        vpcIdentifier: props.vpc.vpcId,
        privateDnsEnabled: true,
        securityGroupIds: [serviceNetworkVpcAssociationSg.securityGroupId],
      },
    );

    /**
     * Creates a log group for this block's VPC Lattice Network.
     */
    const vpcLatticeAccessLogGroup = new logs.LogGroup(
      this,
      "vpc-lattice-access-log-group",
      {
        logGroupName: `vpc-lattice-network/access`,
        retention: logs.RetentionDays.THREE_MONTHS,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    );

    /**
     * Create a subscription for the VPC Lattice Service Network access logs
     * to CloudWatch.
     */
    new vpclattice.CfnAccessLogSubscription(
      this,
      "vpc-lattice-service-network-cloudwatch-access-log-subscription",
      {
        resourceIdentifier: latticeServiceNetwork.attrArn,
        destinationArn: vpcLatticeAccessLogGroup.logGroupArn,
        // We only want to capture service traffic
        serviceNetworkLogType: "SERVICE",
      },
    );

    const service1VpcLatticeService = new vpclattice.CfnService(
      this,
      "service-1-vpc-lattice-service",
      {
        name: "service-1-vpc-lattice-service",
        authType: "NONE",
      },
    );

    /**
     * Create a lambda to act as a service to expose through a lattice service
     * network.
     */
    const service1Lambda = new lambda.Function(this, "service-1-lambda", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('VPC Lattice Event:', JSON.stringify(event, null, 2));
          await new Promise(resolve => setTimeout(resolve, 1000));

          return {
            statusCode: 200,
            statusDescription: '200 OK',
            isBase64Encoded: false,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: 'Hello from service 1!',
              path: event.path,
              method: event.method
            })
          };
        };
      `),
      timeout: Duration.seconds(30),
    });

    /**
     * An vpc lattice lambda target group.
     */
    const service1TargetGroup = new vpclattice.CfnTargetGroup(
      this,
      "service-1-vpc-lattice-service-lambda-target-group",
      {
        type: "LAMBDA",
        config: {
          lambdaEventStructureVersion: "V2",
        },
        targets: [
          {
            id: service1Lambda.functionArn,
          },
        ],
      },
    );

    // The lambda's resource policy must allow the vpc lattice target group to
    // invoke the lambda
    // see: https://docs.aws.amazon.com/vpc-lattice/latest/ug/lambda-functions.html#prepare-lambda-function
    service1Lambda.addPermission("AllowVpcLatticeInvoke", {
      principal: new iam.ServicePrincipal("vpc-lattice.amazonaws.com"),
      sourceArn: service1TargetGroup.attrArn,
    });

    new vpclattice.CfnListener(this, "service-1-vpc-lattice-http-listener", {
      serviceIdentifier: service1VpcLatticeService.attrId,
      protocol: "HTTP",
      port: 80,
      defaultAction: {
        forward: {
          targetGroups: [
            {
              targetGroupIdentifier: service1TargetGroup.attrId,
              weight: 100,
            },
          ],
        },
      },
    });

    // Create an association with the vpc lattice service 1 with the
    // lattice service network
    new vpclattice.CfnServiceNetworkServiceAssociation(
      this,
      "service-1-vpc-service-network-association",
      {
        serviceNetworkIdentifier: latticeServiceNetwork.attrId,
        serviceIdentifier: service1VpcLatticeService.attrId,
      },
    );

    /**
     * Create a second vpc lattice service
     */
    const service2VpcLatticeService = new vpclattice.CfnService(
      this,
      "service-2-vpc-lattice-service",
      {
        name: "service-2-vpc-lattice-service",
        authType: "NONE",
      },
    );

    /**
     * Create a lambda to act as a service to expose through a lattice service
     * network.
     */
    const service2Lambda = new lambda.Function(this, "service-2-lambda", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('VPC Lattice Event:', JSON.stringify(event, null, 2));
          await new Promise(resolve => setTimeout(resolve, 2000));

          return {
            statusCode: 200,
            statusDescription: '200 OK',
            isBase64Encoded: false,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: 'Hello from service 2!',
              path: event.path,
              method: event.method
            })
          };
        };
      `),
      timeout: Duration.seconds(30),
    });

    /**
     * An vpc lattice lambda target group.
     */
    const service2TargetGroup = new vpclattice.CfnTargetGroup(
      this,
      "service-2-vpc-lattice-service-lambda-target-group",
      {
        type: "LAMBDA",
        config: {
          lambdaEventStructureVersion: "V2",
        },
        targets: [
          {
            id: service2Lambda.functionArn,
          },
        ],
      },
    );

    // The lambda's resource policy must allow the vpc lattice target group to
    // invoke the lambda
    // see: https://docs.aws.amazon.com/vpc-lattice/latest/ug/lambda-functions.html#prepare-lambda-function
    service2Lambda.addPermission("AllowVpcLatticeInvoke", {
      principal: new iam.ServicePrincipal("vpc-lattice.amazonaws.com"),
      sourceArn: service2TargetGroup.attrArn,
    });

    new vpclattice.CfnListener(this, "service-2-vpc-lattice-http-listener", {
      serviceIdentifier: service2VpcLatticeService.attrId,
      protocol: "HTTP",
      port: 80,
      defaultAction: {
        forward: {
          targetGroups: [
            {
              targetGroupIdentifier: service2TargetGroup.attrId,
              weight: 100,
            },
          ],
        },
      },
    });

    // Create an association with the vpc lattice service 2 with the
    // lattice service network
    new vpclattice.CfnServiceNetworkServiceAssociation(
      this,
      "service-2-vpc-service-network-association",
      {
        serviceNetworkIdentifier: latticeServiceNetwork.attrId,
        serviceIdentifier: service2VpcLatticeService.attrId,
      },
    );

    new CfnOutput(this, "service-1-domain-name", {
      value: service1VpcLatticeService.attrDnsEntryDomainName,
    });

    new CfnOutput(this, "service-2-domain-name", {
      value: service2VpcLatticeService.attrDnsEntryDomainName,
    });
  }
}
