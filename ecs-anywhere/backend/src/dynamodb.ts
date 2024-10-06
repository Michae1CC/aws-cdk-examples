import AWSXRay from 'aws-xray-sdk';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export const ddb = AWSXRay.captureAWSv3Client(new DynamoDBClient());
