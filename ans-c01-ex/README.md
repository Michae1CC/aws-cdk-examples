# Welcome to your CDK TypeScript project

Attempting the call from instance a fails

From instance b

```
aws kms list-keys
{
    "Keys": [
        {
            "KeyId": "518efc3e-d0e3-4a62-8356-acefdb91cc7d",
            "KeyArn": "arn:aws:kms:us-east-1:202533509701:key/518efc3e-d0e3-4a62-8356-acefdb91cc7d"
        },
        ...
    ]
}
```

```
[ec2-user@ip-10-0-95-181 ~]$ dig kms.us-east-1.amazonaws.com

; <<>> DiG 9.18.33 <<>> kms.us-east-1.amazonaws.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 15307
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;kms.us-east-1.amazonaws.com.   IN      A

;; ANSWER SECTION:
kms.us-east-1.amazonaws.com. 52 IN      A       67.220.241.181

;; Query time: 0 msec
;; SERVER: 10.0.0.2#53(10.0.0.2) (UDP)
;; WHEN: Fri Feb 28 12:47:00 UTC 2025
;; MSG SIZE  rcvd: 72
```

```
[ec2-user@ip-10-1-167-200 ~]$ dig kms.us-east-1.amazonaws.com

; <<>> DiG 9.18.33 <<>> kms.us-east-1.amazonaws.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 17377
;; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;kms.us-east-1.amazonaws.com.   IN      A

;; ANSWER SECTION:
kms.us-east-1.amazonaws.com. 60 IN      A       10.1.58.47
kms.us-east-1.amazonaws.com. 60 IN      A       10.1.139.164

;; Query time: 0 msec
;; SERVER: 10.1.0.2#53(10.1.0.2) (UDP)
;; WHEN: Fri Feb 28 12:46:42 UTC 2025
;; MSG SIZE  rcvd: 88
```

The following hangs, could be transitivity issues
```
[ec2-user@ip-10-0-95-181 ~]$ aws kms list-keys --endpoint-url https://10.1.58.47
```

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## References

* <https://dev.to/aws-builders/aws-advanced-networking-specialty-15-hands-on-exercises-for-certification-success-4eh7>
