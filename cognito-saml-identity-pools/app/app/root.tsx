import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import styles from "./tailwind.css";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { useEffect, useState } from "react";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import Cookies from "js-cookie";
import { DynamoDbClientContext, JwtDecodedContext } from "./utils/context";
import { jwtDecode } from "jwt-decode";
import type { JwtPayload } from "./types";
import { REGION, IDENTITY_POOL_ID, USER_POOL_ID } from "./utils/envar";

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

  useEffect(() => {
    const idTokenString = Cookies.get("idToken");
    const logins: Record<string, string> = {};
    if (idTokenString) {
      setDecodedJwt(jwtDecode(idTokenString));
      logins[`cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`] =
        idTokenString;
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

  return (
    <DynamoDbClientContext.Provider value={dynamodbClient}>
      <JwtDecodedContext.Provider value={decodedJwt}>
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
      </JwtDecodedContext.Provider>
    </DynamoDbClientContext.Provider>
  );
}
