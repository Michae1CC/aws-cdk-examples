export type Paste = {
  id: {
    S: string;
  };
  paste: {
    S: string;
  };
};

export const PartitionKey = 'id';

export const TableName = 'paste';
