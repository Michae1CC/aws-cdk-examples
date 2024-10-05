import AWSXRay from 'aws-xray-sdk';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export const ddb = AWSXRay.captureAWSv3Client(
  new DynamoDBClient({
    endpoint: {
      url: new URL('http://rpi1-3b.local:8000')
    },
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'dummyAccessKeyId',
      secretAccessKey: 'dummySecretAccessKey'
    }
  })
);
