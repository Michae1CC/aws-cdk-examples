for i in {1..10}; do
  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  VALUE=40

  cat > ./metric.json <<EOF
[
  {
    "MetricName": "nginx_connections_active",
    "Timestamp": "$TIMESTAMP",
    "Value": $VALUE,
    "Unit": "None",
    "Dimensions": [
      { "Name": "InstanceId", "Value": "i-0687dae911c2e2719" },
      { "Name": "AutoScalingGroupName", "Value": "nginx-cluster-stack-nginxclusterasgASG2E4CDAB7-MHALBMgGajBJ" },
      { "Name": "InstanceType", "Value": "c8gn.medium" }
    ]
  }
]
EOF

  aws cloudwatch put-metric-data \
    --namespace "Service/NginxStatus" \
    --metric-data file://./metric.json \
    --region ap-southeast-2

  echo "Pushed data point $i"
  cat ./metric.json
  sleep 10
done
