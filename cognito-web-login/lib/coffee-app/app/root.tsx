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
import { useEffect } from "react";

const getCookie = (name: string, cookieString: string): string => {
  const cookieArray = cookieString.split("; ");
  for (const item of cookieArray) {
    if (item.startsWith(`${name}=`)) {
      return item.substring(`${name}=`.length);
    }
  }
  return "";
};

export const loader = async ({ request }: { request: Request }) => {
  const cookieHeader = request.headers.get("Cookie");

  console.log("Executing remix backend");
  const idTokenString = getCookie("idToken", cookieHeader || "");
  console.log(cookieHeader);
  console.log(idTokenString);

  // await getAccessKeys(idTokenString);

  return json({
    headers: {
      // "Set-Cookie": "Hi",
    },
  });
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
  useEffect(() => {
    const creds = fromCognitoIdentityPool({
      identityPoolId: IDENTITY_POOL_ID,
      clientConfig: { region: REGION },
    });
    console.log("Got here");
    console.log(creds());
  });

  return (
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
  );
}
