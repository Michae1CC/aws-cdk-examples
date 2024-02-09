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
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { AwsAccessKey } from "./types";
import axios from "axios";
import { Cookie, json } from "@remix-run/node";
import { idToken } from "./utils/cookies";

export const loader = async ({ request }: { request: Request }) => {
  // const cookieHeader = request.headers.get("Cookie");

  console.log("Executing remix backend");

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

export default function App() {
  const [awsAccessKeys, setAwsAccessKeys] = useState<AwsAccessKey | null>(
    undefined
  );
  const [userInformation, setUserInformation] = useState<null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  const hiCookie = useLoaderData<typeof loader>();
  console.log(hiCookie);

  // useEffect(() => {
  //   const searchParameters = new URLSearchParams(location.hash);
  //   const id =
  //     searchParameters.get("#id_token") ?? searchParameters.get("id_token");
  //   console.log(id);
  //   setIdToken(id);
  // }, []);

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
