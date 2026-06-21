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
  public readonly amiParameter: ssm.StringParameter;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    /**
     * A role used Image builder to build instances
     * See: https://docs.aws.amazon.com/imagebuilder/latest/userguide/getting-started-image-builder.html#image-builder-IAM-prereq
     */
    const imageBuilderWorkerIamRole = new iam.Role(
      this,
      "image-builder-worker-role",
      {
        assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
        managedPolicies: [
          // Allows us to use SSM to connect to instances, see:
          //  https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-with-systems-manager-session-manager.html
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

    // Get the SSM parameter name for the latest ARM Linux 2023 AMI
    const armLinux2023ParameterName =
      ec2.AmazonLinux2023ImageSsmParameter.ssmParameterName({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
        kernel: ec2.AmazonLinux2023Kernel.DEFAULT,
        edition: ec2.AmazonLinuxEdition.STANDARD,
      });

    /**
     * Create a parameter to hold the AMI built for the cluster. ImageBuilder
     * will use this AWSServiceRoleForImageBuilder service linked role to
     * perform updates to the parameter, this service linked role only has
     * permissions to update parameters prefixed with `/imagebuilder`.
     */
    this.amiParameter = new ssm.StringParameter(
      this,
      "nginx-cluster-ami-parameter",
      {
        parameterName: "/imagebuilder/cluster-ami",
        description: "Latest ARM Linux 2023 AMI ID",
        stringValue: ssm.StringParameter.valueFromLookup(
          this,
          armLinux2023ParameterName,
        ),
        dataType: ssm.ParameterDataType.AWS_EC2_IMAGE,
        tier: ssm.ParameterTier.STANDARD,
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
      "node-dependencies-component",
      {
        name: "NginxClusterNodeDependencies",
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
                        [
                          "set -ex",
                          "whoami",
                          "dnf update",
                          "dnf install -y cowsay nginx",
                          // This is relying on Amazon linux AMIS to have AWS SSM agent pre-installed
                          //  see: https://docs.aws.amazon.com/systems-manager/latest/userguide/agent-install-al2.html
                          "systemctl enable amazon-ssm-agent",
                          "systemctl enable nginx",
                        ].join("\n"),
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
        name: "NginxClusterNode",
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

    const distributionConfiguration =
      new imagebuilder.CfnDistributionConfiguration(
        this,
        "distribution-configuration",
        {
          name: "NginxClusterNode",
          distributions: [
            {
              ssmParameterConfigurations: [
                {
                  parameterName: this.amiParameter.parameterName,
                  amiAccountId: this.account,
                  dataType: ssm.ParameterDataType.AWS_EC2_IMAGE,
                },
              ],
              region: "ap-southeast-2",
            },
          ],
        },
      );

    const infrastructureConfiguration =
      new imagebuilder.CfnInfrastructureConfiguration(
        this,
        "infrastructure-configuration",
        {
          name: "NginxClusterNode",
          instanceProfileName:
            imageBuilderWorkerIamInstanceProfile.instanceProfileName,
          instanceTypes: [
            // Use one of the cheapest machines with an ARM CPU architecture
            ec2.InstanceType.of(
              ec2.InstanceClass.M6G,
              ec2.InstanceSize.MEDIUM,
            ).toString(),
          ],
          subnetId: props.vpc.publicSubnets[0].subnetId,
          securityGroupIds: [imageBuilderWorkerSecurityGroup.securityGroupId],
          terminateInstanceOnFailure: true,
        },
      );

    new imagebuilder.CfnImagePipeline(
      this,
      "nginx-cluster-node-image-pipeline",
      {
        name: "NginxClusterNode",
        status: "ENABLED",
        infrastructureConfigurationArn: infrastructureConfiguration.attrArn,
        imageRecipeArn: nodeImageRecipe.attrArn,
        distributionConfigurationArn: distributionConfiguration.attrArn,
        enhancedImageMetadataEnabled: false,
      },
    );
  }
}
