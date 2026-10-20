# ALB Envoy VPC Lattice Networking Stack

Demonstrates a network stack where a Envoy ECS service perform dynamic forward proxying to VPC Lattice service backends.

Once deployed try running
```bash
seq 0 5000 | xargs -P 50 -I {} curl -v -H "X-Custom-Servicehost: <LATTICE-SERVICE-DOMAIN-NAME>" http://<ALB-DOMAIN-NAME> &>/dev/null
```

Envoy's inbuilt dynamic forward proxy connection pooling should mean backend connections remain low even when there are a high number of requests.