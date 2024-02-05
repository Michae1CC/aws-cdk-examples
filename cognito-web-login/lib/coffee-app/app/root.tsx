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

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  { rel: "stylesheet", href: styles },
];


export async function loader({
  params,
}: LoaderFunctionArgs) {
  // existing code
  const res = axios({
    method: "post",
    url: "/access",
    data: {
      // params.idToken,
    },
  });
  return (await res).data
}

export default function App() {
  const [awsAccessKeys, setAwsAccessKeys] = useState<AwsAccessKey | undefined>(
    undefined
  );
  const [userInformation, setUserInformation] = useState<{}>({});
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [idToken, setIdToken] = useState<string | null>(null);

  const searchParameters = new URLSearchParams(location.hash);
  const id =
    searchParameters.get("#id_token") ?? searchParameters.get("id_token");

  const handleAuth = useCallback(async () => {
    console.log("idToken");
    console.log(idToken);
    if (isLoggedIn) {
      // We don't need new credentials. Return Immediately.
      return;
    }
    if (idToken !== undefined) {
      const res = axios({
        method: "post",
        url: "/access",
        data: {
          idToken,
        },
      });
      setIsLoggedIn(true);
      // TODO:
      // Set aws access keys
      // Set user information
    }
  }, [idToken, isLoggedIn]);

    const x =
    useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Suspense fallback={<div>Loading...</div>}>
          <Await resolve={x} errorElement={<div>Errored</div>}>
            {(resolved) => {
              return (
                <>
                  <div>{resolved}</div>
                  {/* <Outlet />
                  <ScrollRestoration />
                  <Scripts />
                  <LiveReload /> */}
                </>
              );
            }}
          </Await>
        </Suspense>
      </body>
    </html>
  );
}
