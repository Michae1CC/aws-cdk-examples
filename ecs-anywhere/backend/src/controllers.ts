import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';

import { Paste } from './models/index.js';
import { ddb } from './dynamodb.js';

export const getPaste = async (id: string, logger: winston.Logger): Promise<{ text: string }> => {
  logger.info(`Getting paste with id: ${id}`);
  const item = await ddb.send(
    new GetItemCommand({
      TableName: 'paste',
      Key: {
        [Paste.PartitionKey]: {
          S: id
        }
      }
    })
  );
  const text = item.Item?.paste.S;
  if (text === undefined) {
    throw new Error('Item not found');
  }
  return { text: text };
};

export const putPaste = async (text: string, logger: winston.Logger): Promise<string> => {
  const pasteId = uuidv4();
  await ddb.send(
    new PutItemCommand({
      TableName: 'paste',
      Item: {
        id: {
          S: pasteId
        },
        paste: {
          S: text
        }
      } satisfies Paste.Paste
    })
  );
  logger.info(`Created paste with id: ${pasteId}`);
  return pasteId;
};
