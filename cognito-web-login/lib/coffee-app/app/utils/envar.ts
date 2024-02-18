const getEnvOrThrow = (name: string) => {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Could not find envar ${name}`);
  }
  return value;
};

export const REGION = getEnvOrThrow("REGION");
export const IDENTITY_POOL_ID = getEnvOrThrow("IDENTITY_POOL_ID ");
export const USER_POOL_PROVIDER = getEnvOrThrow("USER_POOL_PROVIDER");
export const DYNAMO_TABLE_NAME = getEnvOrThrow("DYNAMO_TABLE_NAME");
