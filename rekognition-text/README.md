# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Upload an image to s3 via cli

Run the command

```bash
aws s3 ls
```

to view all of your buckets

```bash
aws s3 cp ./imgs/example_license.png s3://<bucket-uri>
```

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

# References

- https://serverlessland.com/patterns/s3-lambda-transcribe-cdk
- https://github.com/dan-mba/aws-cdk-rekognition
- https://docs.aws.amazon.com/rekognition/latest/dg/text-detecting-text-procedure.html
- https://github.com/aws-samples/aws-cdk-examples/tree/master/python/image-content-search
