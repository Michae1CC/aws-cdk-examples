# AWS CDK examples

Examples of small services I've put together using AWS CDK v2 (in typescript) to help learn about the products AWS provides. All diagrams were created using either [Lucid](https://lucid.app) or [drawio](https://www.drawio.com/).

| Example                                         | Description                                                                               | Tags                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [alb-ssl-bridging](./alb-ssl-bridging/)         | ![alb-ssl-bridging](./alb-ssl-bridging/img/alb-ssl-bridging-architecture.png)             | route 53, fargate, certificate manager, cloudwatch, sns |
| [apigw-to-dynamodb](./apigw-to-dynamodb/)       | ![apigw-to-dynamodb](./apigw-to-dynamodb/img/apigw-to-dynamodb-architecture.png)          | apigw, dynamodb, lambda, sns                            |
| [apigw-ws](./apigw-ws/)       | ![apigw-ws](./apigw-ws/img/apigw-ws-architecture.png)          | apigw, dynamodb, lambda                            |
| [central-dns](./central-dns/)       | ![central-dns](./central-dns/img/central-dns-architecture.png)          | route53, sqs
| [code-deploy](./code-deploy/)       | ![code-deploy](./code-deploy/img/code-deploy-architecture.png)          | code deploy, code build, code pipeline, lambda                            |
| [cognito-saml-identity-pools](./cognito-saml-identity-pools/)       | ![cognito-saml-identity-pools](./cognito-saml-identity-pools/img/cognito-saml-identity-pools-architecture.png)          | dynamodb, cognito, fargate                            |
| [dynamo-vpc-gateway-endpoint](./dynamo-vpc-gateway-endpoint/)       | ![dynamo-vpc-gateway-endpoint](./dynamo-vpc-gateway-endpoint/img/dynamo-vpc-gateway-endpoint-architecture.png)          | dynamodb, cognito, apigw, alb                            |
| [ecs-anywhere](./ecs-anywhere/)       | ![ecs-anywhere](./ecs-anywhere/img/ecs-anywhere-architecture.png)          | dynamodb, ecs, sqs                            |
| [ecs-full-ipv6](./ecs-full-ipv6/)       | ![ecs-full-ipv6](./ecs-full-ipv6/img/ecs-full-ipv6-architecture.png)          | ecs, cloudwatch                             |
| [lambda-to-fargate](./lambda-to-fargate/)       | ![lambda-to-fargate](./lambda-to-fargate/img/lambda-to-fargate-architecture.png)          | apigw, fargate, lambda                                  |
| [rekcognition-text](./rekognition-text/)        | ![rekcognition-text](./rekognition-text/img/rekognition-text-architecture.png)            | s3, lambda, rekognition, dynamodb                       |
| [route53-dnssec-enabled](./route53-dnssec-enabled/)        | ![route53-dnssec-enabled](./route53-dnssec-enabled/img/route53-dnssec-enabled-architecture.png)            | route53, lambda, kms, api-gateway                       |
| [sqs-sns-fanout](./sqs-sns-fanout/)        | ![sqs-sns-fanout](./sqs-sns-fanout/img/sqs-sns-fanout-architecture.png)            | sqs, s3, ecs, fargate |
| [step-function-map-io](./step-function-map-io/) | ![step-function-map-io](./step-function-map-io/img/step-function-map-io-architecture.png) | stepfunction, s3, lambda, dynamodb                      |
| [vgw-site2site-vpn](./vgw-site2site-vpn/)             | ![vgw-site2site-vpn](./vgw-site2site-vpn/img/vgw-site2site-vpn-architecture.png)                   | vpc, vgw, vpn                         |
| [vpc-cloudwatch](./vpc-cloudwatch/)             | ![vpc-cloudwatch](./vpc-cloudwatch/img/vpc-cloudwatch-architecture.png)                   | vpc, cloudwatch, flow logs, ec2                         |
| [waf-cloudfront-ssm](./waf-cloudfront-ssm/)     | ![waf-cloudfront-ssm](./waf-cloudfront-ssm/img/waf-cloudfront-ssm-architecture.png)       | waf, cloudfront, ssm, vpc, ec2, fargate                 |
