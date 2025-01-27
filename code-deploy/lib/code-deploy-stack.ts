import {
  aws_codebuild as codebuild,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_actions,
  aws_ecr as ecr,
  aws_iam as iam,
  aws_s3 as s3,
  aws_ssm as ssm,
  SecretValue,
  Stack,
  StackProps,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

interface CodeDeployStackProps extends StackProps {
  appEcrRepository: ecr.Repository;
}

export class CodeDeployStack extends Stack {
  constructor(scope: Construct, id: string, props: CodeDeployStackProps) {
    super(scope, id, props);

    const pipelineArtifactBucket = new Bucket(this, "pipelineArtifact", {
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    const sourceCodeArtifact = new codepipeline.Artifact();

    /**
     *
     * References:
     *  https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_codepipeline_actions.GitHubSourceAction.html
     *  https://docs.aws.amazon.com/codepipeline/latest/userguide/connections-github.html
     *  https://docs.aws.amazon.com/codepipeline/latest/userguide/appendix-github-oauth.html#GitHub-create-personal-token-CLI
     *  https://docs.aws.amazon.com/codepipeline/latest/userguide/appendix-github-oauth.html#action-reference-GitHub
     */
    const sourceCodeAction = new codepipeline_actions.GitHubSourceAction({
      actionName: "Source",
      oauthToken: SecretValue.secretsManager("codepipelineExample", {
        jsonField: "githubActionPersonalAccessToken",
      }),
      output: sourceCodeArtifact,
      owner: "Michae1CC",
      repo: "hello-food",
      branch: "main",
      trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
    });

    const exampleProject = new codebuild.PipelineProject(
      this,
      "exampleProject",
      {
        buildSpec: codebuild.BuildSpec.fromObjectToYaml({
          version: 0.2,
          phases: {
            pre_build: {
              commands: [
                "set -euo pipefail",
                "echo Logging in to Amazon ECR",
                "aws --version",
                "aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com",
              ],
            },
            build: {
              commands: [
                "echo Build started on `date`",
                "echo Building the Docker image",
                "echo REGION ${REGION}",
                "echo ACCOUNT ${ACCOUNT}",
                "echo REPOSITORY_URI ${REPOSITORY_URI}",
                "COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)",
                "IMAGE_TAG=${COMMIT_HASH:=latest}",
                "docker build -t ${REPOSITORY_URI}:latest .",
                "docker tag ${REPOSITORY_URI}:latest ${REPOSITORY_URI}:${IMAGE_TAG}",
              ],
            },
            post_build: {
              commands: [
                "echo Post build started on `date`",
                "echo Pushing the Docker images",
                "docker push ${REPOSITORY_URI}:latest",
                "docker push ${REPOSITORY_URI}:${IMAGE_TAG}",
                "echo Writing image definitions file",
                'printf \'[{"name":"hello-food","imageUri":"%s"}]\' ${REPOSITORY_URI}:${IMAGE_TAG} > imagedefinitions.json',
              ],
            },
          },
          artifacts: {
            files: "imagedefinitions.json",
          },
        }),
        environment: {
          buildImage:
            codebuild.LinuxArmBuildImage.AMAZON_LINUX_2023_STANDARD_3_0,
        },
        environmentVariables: {
          REGION: {
            value: this.region,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
          ACCOUNT: {
            value: this.account,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
          REPOSITORY_URI: {
            value: props.appEcrRepository.repositoryUri,
            type: codebuild.BuildEnvironmentVariableType.PLAINTEXT,
          },
        },
      },
    );

    /**
     * When you use a cross-account or private registry image, you must use SERVICE_ROLE credentials.
     * https://docs.aws.amazon.com/codebuild/latest/APIReference/API_ProjectEnvironment.html
     */
    exampleProject.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:GetAuthorizationToken",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
        ],
      }),
    );

    pipelineArtifactBucket.grantPut(exampleProject);

    const codebuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "Build",
      input: sourceCodeArtifact,
      project: exampleProject,
    });

    new codepipeline.Pipeline(this, "examplePipeline", {
      artifactBucket: pipelineArtifactBucket,
      stages: [
        {
          stageName: "Source",
          actions: [sourceCodeAction],
        },
        {
          stageName: "Build",
          actions: [codebuildAction],
        },
      ],
    });
  }
}
