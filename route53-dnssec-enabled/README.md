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

## Deployment Strategy

* Enable monitoring for DNSSEC failures
* Reduce both zone's maximum TTL [see](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-enable-signing.html#dns-configuring-dnssec-enable-signing-step-1)
* Lower the SOA TTL and SOA minimum field
* Make sure TTL and SOA changes are effective
* Add DNSSEC signing and create KSK via Cloudformation [see](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec-enable-signing.html#dns-configuring-dnssec-enable)

- Original min SOA was 86400
- Original CNAME was 900

## References

* <https://learn.cantrill.io/courses/1820301/lectures/43460378>
* <https://www.cloudflare.com/dns/dnssec/how-dnssec-works/>
* <https://github.com/GemeenteNijmegen/modules-dnssec-record>
* <https://repost.aws/knowledge-center/create-subdomain-route-53>
* <https://deepdive.codiply.com/enable-dnssec-signing-in-amazon-route-53-using-aws-cdk>
