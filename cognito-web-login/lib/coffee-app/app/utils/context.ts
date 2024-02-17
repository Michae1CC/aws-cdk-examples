import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { createContext, useContext } from "react";
import type { JwtPayload } from "../types";

export const DynamoDbClientContext = createContext<DynamoDBClient | undefined>(
  undefined
);

export const JwtDecodedContext = createContext<JwtPayload | undefined>(
  undefined
);

export const useInitialisedContext = <T>(context: React.Context<T>) => {
  const requiredContext = useContext(context);

  if (requiredContext === undefined) {
    throw new Error(
      "Context does not exist. Either the context provider has not yet initialised or something went wrong."
    );
  }

  return requiredContext;
};
