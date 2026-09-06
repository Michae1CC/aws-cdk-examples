# Cloudfront to ASG using S3 Files

## Test

Ensure you have created a `.env` in the top level directory with the following
variables.

```env
DOMAIN=<YOUR-R53-HZ-PUBLIC-DOMAIN>
ACCOUNT=<YOUR-OPTIONAL-ACCOUNT-ID>
REGION=<YOUR-OPTIONAL-REGION>
```

Cloudformation stacks may be deployed with

```bash
cdk bootstrap && cdk deploy --require-approval=never --all
```

Once deployed, you will need to run the `NginxClusterNode` and then refresh the
cluster instances. After, you should be able to access the S3 deployed website
from `files.<YOUR-R53-HZ-PUBLIC-DOMAIN>`.

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
* <https://www.youtube.com/watch?v=ScDv02ff8oc>
* <https://www.youtube.com/watch?v=yaijcGJnFQY&t=35s>
* <https://aws.amazon.com/blogs/aws/launching-s3-files-making-s3-buckets-accessible-as-file-systems/>
* <https://www.youtube.com/watch?v=2DrjQBL5FMU&t=1271s>
* <https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-files-prereq-policies.html>
* <https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-files-mounting.html>
