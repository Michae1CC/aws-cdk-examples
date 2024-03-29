import * as cdk from "aws-cdk-lib";
import {
  aws_apigatewayv2 as apigatewayv2,
  aws_apigatewayv2_integrations as apigatewayv2_integrations,
  aws_certificatemanager as acm,
  aws_lambda_nodejs as lambdaJs,
  aws_lambda as lambda,
  aws_route53 as route53,
  aws_route53_targets as route53_targets,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

interface LambdaServiceStackProps extends cdk.StackProps {
  serviceDomainName: string;
  serviceHostedZone: route53.IHostedZone;
}

export class LambdaServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LambdaServiceStackProps) {
    super(scope, id, props);

    const handler = new lambdaJs.NodejsFunction(this, "serviceLambda", {
      memorySize: 256,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      bundling: {
        sourceMap: true,
      },
      environment: {
        NODE_OPTIONS: "--enable-source-maps",
      },
      entry: path.join(__dirname, "..", "lambda", "service", "lambda.ts"),
      handler: "handler",
    });

    const serviceDomainCertificate = new acm.Certificate(
      this,
      "serviceDomainCertificate",
      {
        domainName: props.serviceDomainName,
        validation: acm.CertificateValidation.fromDns(props.serviceHostedZone),
      }
    );

    const serviceApiGatewayDomainName = new apigatewayv2.DomainName(
      this,
      "serviceApiGatewayDomainName",
      {
        domainName: props.serviceDomainName,
        certificate: serviceDomainCertificate,
      }
    );

    const httpApiGateway = new apigatewayv2.HttpApi(this, "httpApiGateway", {
      defaultDomainMapping: {
        domainName: serviceApiGatewayDomainName,
        // Leave this as undefined to use the domain root
        mappingKey: undefined,
      },
      defaultIntegration: new apigatewayv2_integrations.HttpLambdaIntegration(
        "serviceLambdaHttpApiGatewayIntegration",
        handler
      ),
    });

    // Create an A record within our service hosted zone to point our service
    // domain name to the api gateway
    const apiGatewayARecord = new route53.ARecord(this, "apiGatewayARecord", {
      recordName: props.serviceDomainName,
      zone: props.serviceHostedZone,
      target: route53.RecordTarget.fromAlias(
        new route53_targets.ApiGatewayv2DomainProperties(
          serviceApiGatewayDomainName.regionalDomainName,
          serviceApiGatewayDomainName.regionalHostedZoneId
        )
      ),
      ttl: cdk.Duration.minutes(5),
    });
  }
}
