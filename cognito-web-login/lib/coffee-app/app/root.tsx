import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
  Await,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import styles from "./tailwind.css";
import { json } from "@remix-run/node";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { getAccessKeys } from "./utils/userAccessCredentials";
import { useEffect, useState, createContext, useMemo } from "react";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import Cookies from "js-cookie";
import { DynamoDbClientContext } from "./utils/context";

const getCookie = (name: string, cookieString: string): string | undefined => {
  const cookieArray = cookieString.split("; ");
  for (const item of cookieArray) {
    if (item.startsWith(`${name}=`)) {
      return item.substring(`${name}=`.length);
    }
  }
  return undefined;
};

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  { rel: "stylesheet", href: styles },
];

const REGION = "us-east-1";
const ACCOUNT = "221318883170";
const IDENTITY_POOL_ID = "us-east-1:7caadd62-7647-4b8b-86b8-e8bae192eaaf";
const USER_POOL_PROVIDER =
  "cognito-idp.us-east-1.amazonaws.com/us-east-1_2E6fWKuiW";

export default function App() {
  const [dynamodbClient, setDynamodbClient] = useState<
    DynamoDBClient | undefined
  >(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const idTokenString = Cookies.get("idToken");
    const logins: Record<string, string> = {};
    if (idTokenString) {
      logins[USER_POOL_PROVIDER] = idTokenString;
    }
    const createDynamoResources = async () => {
      const creds = fromCognitoIdentityPool({
        identityPoolId: IDENTITY_POOL_ID,
        clientConfig: { region: REGION },
        logins: logins,
      });
      setDynamodbClient(
        new DynamoDBClient({
          region: REGION,
          credentials: creds,
        })
      );
    };
    createDynamoResources();
    setLoading(false);
  }, [loading]);

  // if (loading) {
  //   console.log("Hi");
  //   return <h1>Hi</h1>;
  // }

  return (
    <DynamoDbClientContext.Provider value={dynamodbClient}>
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
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
    </DynamoDbClientContext.Provider>
  );
}
