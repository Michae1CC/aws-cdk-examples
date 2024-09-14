export type Paste = {
  id: {
    S: string;
  };
  paste: {
    S: string;
  };
  createdAt: {
    N: number;
  };
};

export const PartitionKey = 'id';

export const SortKey = 'createdAt';

export const TableName = 'paste';
