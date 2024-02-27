import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import styles from "./tailwind.css";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { useEffect, useState } from "react";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import Cookies from "js-cookie";
import {
  DynamoDbClientContext,
  EnvContext,
  JwtDecodedContext,
} from "./utils/context";
import { jwtDecode } from "jwt-decode";
import type { EnvironmentVariables, JwtPayload } from "./types";
import { json } from "@remix-run/node";

export async function loader() {
  const processEnvs = {
    REGION: process.env.REGION!,
    ACCOUNT: process.env.ACCOUNT!,
    TABLE_NAME: process.env.TABLE_NAME!,
    APP_DOMAIN: process.env.APP_DOMAIN!,
    IDENTITY_POOL_ID: process.env.IDENTITY_POOL_ID!,
    USER_POOL_ID: process.env.USER_POOL_ID!,
    USER_POOL_DOMAIN: process.env.USER_POOL_DOMAIN!,
    OKTA_APP_CLIENT_ID: process.env.OKTA_APP_CLIENT_ID!,
    OKTA_ID_PROVIDER_NAME: process.env.OKTA_ID_PROVIDER_NAME!,
  } satisfies EnvironmentVariables;
  console.log(processEnvs);
  return json(processEnvs);
}

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  { rel: "stylesheet", href: styles },
];

export default function App() {
  const [dynamodbClient, setDynamodbClient] = useState<
    DynamoDBClient | undefined
  >(undefined);
  const [decodedJwt, setDecodedJwt] = useState<JwtPayload | undefined>(
    undefined
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [env, setEnv] = useState<EnvironmentVariables>(
    useLoaderData<typeof loader>()
  );

  useEffect(() => {
    console.log("Using the following envs");
    console.log(env);
    const idTokenString = Cookies.get("idToken");
    const logins: Record<string, string> = {};
    if (idTokenString) {
      setDecodedJwt(jwtDecode(idTokenString));
      logins[`cognito-idp.${env.REGION}.amazonaws.com/${env.USER_POOL_ID}`] =
        idTokenString;
    }
    const createDynamoResources = async () => {
      const creds = fromCognitoIdentityPool({
        identityPoolId: env.IDENTITY_POOL_ID,
        clientConfig: { region: env.REGION },
        logins: logins,
      });
      setDynamodbClient(
        new DynamoDBClient({
          region: env.REGION,
          credentials: creds,
        })
      );
    };
    createDynamoResources();
    setLoading(false);
  }, [loading, env]);

  return (
    <DynamoDbClientContext.Provider value={dynamodbClient}>
      <JwtDecodedContext.Provider value={decodedJwt}>
        <EnvContext.Provider value={env}>
          <html lang="en">
            <head>
              <meta charSet="utf-8" />
              <meta
                name="viewport"
                content="width=device-width,initial-scale=1"
              />
              <Meta />
              <Links />
            </head>
            <body>
              <Outlet />
              <ScrollRestoration />
              <Scripts />
              <LiveReload />
            </body>
          </html>
        </EnvContext.Provider>
      </JwtDecodedContext.Provider>
    </DynamoDbClientContext.Provider>
  );
}
