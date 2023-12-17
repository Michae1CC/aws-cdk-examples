# ALB SSL Bridging

When setting up routing configurations from load balancers to target groups, you
have three options our how HTTPS connections are handled:

* Bridging: Have an ALB decrypt the connect and re-encrypt the traffic when
forwarding it to a target group.
* Pass-through: Have a NLB pass encrypted traffic directly to the target groups.
* Offload: Have an ALB decrypt the connection and have it send un-encrypted
to the target groups.

This slide from Adrian Cantrill's Associate Solutions Architect online course
summaries it nicely:

![lb-ssl-connection-types](./img/lb-ssl-connection-types.png)

This tutorial will demonstrate how to set up a simple Fargate Service that
utilizes bridging connections to handle secure traffic. The contents of the Dockerfile
are shown below.

## Website Dockerfile

We will use a nginx Docker Image to generate and server the pages for our
website. No particular reason for using a nginx Docker Image, apart from it
being pretty straight to create and attach a self-signed certificate to our
website.

```Dockerfile
FROM --platform=linux/amd64 nginx:latest

USER root

RUN : \
    && mkdir /etc/nginx/ssl \
    && chmod 700 /etc/nginx/ssl \
    && openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx-selfsigned.key -subj /C=AU/ST=/L=/O=/OU=/CN= -out /etc/nginx/ssl/nginx-selfsigned.crt -keyout /etc/nginx/ssl/nginx-selfsigned.key

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 443
```

The AWS documentation mentions that if a target group is configured to use HTTPS,
the load balancer will establish a TLS connections with the target group using
certificates installed on the targets. Since these certificates are not checked,
we can used self-signed certificates here. I've generated self-signed certificates
using the `openssl` command and have add them to our nginx configuration.

## References

* <https://learn.cantrill.io/courses/1820301/lectures/41301447>
* <https://learn.cantrill.io/courses/2022818/lectures/45660745>
* <https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#target-group-routing-configuration>
* <https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-update-security-groups.html>
* <https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_PortMapping.html>
* <https://www.cloudflare.com/learning/dns/glossary/dns-zone/>
* <https://aws.amazon.com/route53/faqs/>
* <https://medium.com/@miladev95/nginx-with-self-signed-certificate-on-docker-a514bb1a4061>
* <https://github.com/aws-samples/serverless-patterns/tree/main/route53-alb-fargate-cdk-dotnet>
* <https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/networking-networkmode-awsvpc.html>
* <https://nedvedyang.medium.com/create-a-cloudformation-template-for-route53-health-check-cloudwatch-alarms-and-sns-49f70d3b3f92>
