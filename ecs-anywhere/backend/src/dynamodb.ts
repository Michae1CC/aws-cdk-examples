import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export const ddb = new DynamoDBClient({
  endpoint: {
    url: new URL('http://rpi1-3b.local:8000')
  },
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'dummyAccessKeyId',
    secretAccessKey: 'dummySecretAccessKey'
  }
});
