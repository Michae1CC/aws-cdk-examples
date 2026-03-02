import {
  aws_ec2 as ec2,
  aws_elasticloadbalancingv2 as elbv2,
  aws_vpclattice as vpclattice,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface VpcLatticeStackProps extends StackProps {
  clientVpc: ec2.Vpc;
  serviceVpc: ec2.Vpc;
  serviceAlb: elbv2.ApplicationLoadBalancer;
}

export class VpcLatticeStack extends Stack {
  constructor(scope: Construct, id: string, props: VpcLatticeStackProps) {
    super(scope, id, props);

    // Following: https://docs.aws.amazon.com/vpc-lattice/latest/ug/services.html

    /**
     * see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_vpclattice.CfnServiceNetwork.html
     */
    const serviceNetwork = new vpclattice.CfnServiceNetwork(
      this,
      "service-network",
      {
        sharingConfig: {
          enabled: true,
        },
      },
    );

    // Associate both the client and service vpc to the vpc lattice network.
    // Vpcs can only have one service association

    new vpclattice.CfnServiceNetworkVpcAssociation(
      this,
      "client-vpc-service-network-association",
      {
        serviceNetworkIdentifier: serviceNetwork.attrId,
        vpcIdentifier: props.clientVpc.vpcId,
      },
    );

    new vpclattice.CfnServiceNetworkVpcAssociation(
      this,
      "service-vpc-service-network-association",
      {
        serviceNetworkIdentifier: serviceNetwork.attrId,
        vpcIdentifier: props.serviceVpc.vpcId,
      },
    );

    const service = new vpclattice.CfnService(this, "lattice-service", {
      name: "my-lattice-service",
    });

    new vpclattice.CfnServiceNetworkServiceAssociation(
      this,
      "lattice-service-association",
      {
        serviceIdentifier: service.attrId,
        serviceNetworkIdentifier: serviceNetwork.attrId,
      },
    );

    /**
     * An vpc lattice target group for the service internal alb.
     */
    const targetGroup = new vpclattice.CfnTargetGroup(
      this,
      "alb-target-group",
      {
        type: "ALB",
        config: {
          port: 80,
          protocol: "HTTP",
          vpcIdentifier: props.serviceVpc.vpcId,
        },
        targets: [
          {
            id: props.serviceAlb.loadBalancerArn,
            port: 80,
          },
        ],
      },
    );

    const listener = new vpclattice.CfnListener(this, "listener", {
      serviceIdentifier: service.attrId,
      protocol: "HTTP",
      defaultAction: {
        forward: {
          targetGroups: [
            {
              targetGroupIdentifier: targetGroup.attrId,
              weight: 100,
            },
          ],
        },
      },
    });
  }
}
