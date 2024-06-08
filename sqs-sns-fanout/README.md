# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Commands

```bash
aws sts get-caller-identity --profile design
```

```bash
aws s3api put-object --profile design --bucket arn:aws:s3:us-east-1:<account-number>:accesspoint/design-ap --key icons8-bucket.png --body ./img/icons8-bucket.png
```

## References

* <https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points.html>
* <https://github.com/aws-samples/aws-cdk-examples/blob/9164f0e582c63d6f5fb0b03576920d330ddfea95/typescript/s3-object-lambda/lib/s3-object-lambda-stack.ts#L82>
* <https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points-policies.html#access-points-policy-examples>
* <https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points-policies.html#access-points-delegating-control>
* <https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-access-points.html>
* <https://docs.aws.amazon.com/cdk/v2/guide/how_to_set_cw_alarm.html>
* <https://docs.aws.amazon.com/signin/latest/userguide/introduction-to-iam-user-sign-in-tutorial.html>
* <https://github.com/awsdocs/amazon-s3-developer-guide/blob/master/doc_source/using-access-points.md>
* <https://github.com/ksmin23/my-aws-cdk-examples/tree/main/lambda/async-invoke>
* <https://cdkpatterns.com/patterns/filter/?by=EventBridge>
* <https://github.com/cdk-patterns/serverless/tree/main/the-destined-lambda>
* <https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3.Bucket.html#addwbreventwbrnotificationevent-dest-filters>
* <https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam.AccessKey.html>
* <https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/run-message-driven-workloads-at-scale-by-using-aws-fargate.html>
* <https://github.com/aws-samples/sqs-fargate-ddb-cdk-go/blob/main/cdk/lib/FargateServiceStack.ts>
* <https://github.com/aws-samples/serverless-patterns/blob/main/eventbridge-sqs-ecs-cdk/src/lib/eb-sqs-ecs-stack.ts>
* <https://github.com/aws-samples/serverless-patterns/blob/main/eventbridge-schedule-to-lambda-cdk/cdk/lib/eventbridge-scehdules-with-cdk-stack.ts>
