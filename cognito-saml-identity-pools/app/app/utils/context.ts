import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { createContext } from "react";
import type { EnvironmentVariables, JwtPayload } from "../types";

export const DynamoDbClientContext = createContext<DynamoDBClient | undefined>(
  undefined
);

export const JwtDecodedContext = createContext<JwtPayload | undefined>(
  undefined
);

export const EnvContext = createContext<EnvironmentVariables>({} as any);
