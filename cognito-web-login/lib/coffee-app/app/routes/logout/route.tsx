import type { LinksFunction } from "@remix-run/node";

import stylesUrl from "~/styles/index.css";
import { useEffect } from "react";
import Cookies from "js-cookie";
import {
  APP_DOMAIN,
  OKTA_APP_CLIENT_ID,
  REGION,
  USER_POOL_NAME,
} from "~/utils/envar";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export default function Route() {
  useEffect(() => {
    const logoutProcess = async () => {
      Cookies.set("idToken", "");
      Cookies.set("accessToken", "");
      window.location.href = `https://${USER_POOL_NAME}.auth.${REGION}.amazoncognito.com/logout?client_id=${OKTA_APP_CLIENT_ID}&logout_uri=http%3A%2F%2F${APP_DOMAIN}&redirect_uri=http%3A%2F%2F${APP_DOMAIN}&response_type=token`;
    };
    logoutProcess();
  });

  return (
    <div>
      <div className="content-main">
        <div className="search-main">
          <h3>You are being logged out</h3>
        </div>
      </div>
    </div>
  );
}
