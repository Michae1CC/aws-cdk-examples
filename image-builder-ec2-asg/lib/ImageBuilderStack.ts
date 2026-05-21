import {
  aws_imagebuilder as imagebuilder,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_iam as iam,
  aws_ssm as ssm,
  StackProps,
} from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as yaml from "yaml";

interface Props extends StackProps {
  vpc: ec2.Vpc;
}

export class ImageBuilderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    /**
     * See: https://docs.aws.amazon.com/imagebuilder/latest/userguide/getting-started-image-builder.html#image-builder-IAM-prereq
     */
    const imageBuilderWorkerIamRole = new iam.Role(
      this,
      "image-builder-worker-role",
      {
        assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "AmazonSSMManagedInstanceCore",
          ),
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "EC2InstanceProfileForImageBuilder",
          ),
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "EC2InstanceProfileForImageBuilderECRContainerBuilds",
          ),
        ],
      },
    );

    /**
     * Security group used by the instances created to build the AMIs
     */
    const imageBuilderWorkerSecurityGroup = new ec2.SecurityGroup(
      this,
      "image-builder-worker-security-group",
      {
        vpc: props.vpc,
        allowAllOutbound: true,
      },
    );

    /**
     * Instance profile for EC2 instances launched by Image Builder for building images.
     */
    const imageBuilderWorkerIamInstanceProfile = new iam.InstanceProfile(
      this,
      "builder-worker-instanceprofile",
      {
        role: imageBuilderWorkerIamRole,
      },
    );

    const nodeDependenciesComponent = new imagebuilder.CfnComponent(
      this,
      "node-deps-component",
      {
        name: "NodeDependencies",
        platform: "Linux",
        version: "1.0.0",
        data: yaml.stringify(
          {
            name: "Dependencies",
            schemaVersion: "1.0",
            phases: [
              {
                name: "build",
                steps: [
                  {
                    name: "InstallDependencies",
                    action: "ExecuteBash",
                    inputs: {
                      commands: [
                        ["dnf update", "dnf install -y cowsay nginx"].join(
                          "\n",
                        ),
                      ],
                    },
                  },
                ],
              },
            ],
          },
          {
            lineWidth: 0,
          },
        ),
      },
    );

    /**
     * Cloudformation does not support built in versions. The version must be
     * incremented every time a change is made.
     */
    const nodeImageRecipe = new imagebuilder.CfnImageRecipe(
      this,
      "node-image-recipe",
      {
        name: "Node",
        version: "1.0.0",
        parentImage: `arn:aws:imagebuilder:${this.region}:aws:image/amazon-linux-2023-arm64/x.x.x`,
        components: [
          // Cloudwatch agent
          {
            componentArn: `arn:aws:imagebuilder:${this.region}:aws:component/amazon-cloudwatch-agent-linux/1.0.1`,
          },
          // Node dependencies component
          {
            componentArn: nodeDependenciesComponent.attrArn,
          },
        ],
      },
    );
  }
}
