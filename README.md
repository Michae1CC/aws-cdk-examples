# AWS CDK examples

Examples of small services I've put together to help learn about the products aws provides. All architecture is built use AWS CDK v2 (in typescript). All diagrams were created using [Lucid](https://lucid.app).

| Example                                   | Description                                                                      | Tags                              |
| ----------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------- |
| [apigw-to-dynamodb](./apigw-to-dynamodb/) | ![apigw-to-dynamodb](./apigw-to-dynamodb/img/apigw-to-dynamodb-architecture.png)              | apigw, dynamodb, lambda, sns      |
| [lambda-to-fargate](./lambda-to-fargate/) | ![lambda-to-fargate](./lambda-to-fargate/img/lambda-to-fargate-architecture.png) | apigw, fargate, lambda            |
| [rekcognition-text](./rekognition-text/)  | ![rekcognition-text](./rekognition-text/img/rekognition-text-architecture.png) | s3, lambda, rekognition, dynamodb |
| [vpc-cloudwatch](./vpc-cloudwatch/)  | ![vpc-cloudwatch](./vpc-cloudwatch/img/vpc-cloudwatch-architecture.png) | vpc, cloudwatch, flow logs, ec2 |
| [waf-cloudfront-ssm](./waf-cloudfront-ssm/)  | ![waf-cloudfront-ssm](./waf-cloudfront-ssm/img/waf-cloudfront-ssm-architecture.png) | waf, cloudfront, ssm, vpc, ec2, fargate |
