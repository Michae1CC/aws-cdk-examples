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

## Chores

* [ ] Set up nginx to serve files
* [ ] Get cfn init working
* [ ] Export logs and metrics from ec2
* [ ] Metric dashboards
* [ ] Access log querying
* [ ] Request metrics from access logs

## References

* <https://aws.plainenglish.io/what-is-aws-ssm-session-manager-74babf3d5361>
* <https://docs.aws.amazon.com/autoscaling/ec2/userguide/using-systems-manager-parameters.html>
* <https://nginx.org/en/docs/beginners_guide.html>
* <https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-creationpolicy.html>
* <https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-attribute-updatepolicy.html>
* <https://docs.aws.amazon.com/imagebuilder/latest/userguide/security-iam.html>
* <https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_store>
* <https://docs.nginx.com/nginx/admin-guide/load-balancer/tcp-udp-load-balancer/>
* <https://docs.nginx.com/nginx/admin-guide/web-server/serving-static-content/#enable-sendfile>
* <https://docs.nginx.com/nginx/admin-guide/monitoring/logging/#syslog>
* <https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-config-options.html>
* <https://aws.amazon.com/blogs/aws/reduce-your-operational-overhead-today-with-amazon-cloudfront-saas-manager/>
* <https://aws.amazon.com/blogs/networking-and-content-delivery/adding-http-security-headers-using-amazon-cloudfront/>
* <https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/prerequisites.html>
* <https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/metrics-collected-by-CloudWatch-agent.html>
* <https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Solution-NGINX-On-EC2.html>
