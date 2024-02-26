import type { LinksFunction } from "@remix-run/node";
import stylesUrl from "~/styles/index.css";
import { useEffect } from "react";
import Cookies from "js-cookie";
import {
  APP_DOMAIN,
  OKTA_APP_CLIENT_ID,
  USER_POOL_DOMAIN,
} from "~/utils/envar";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export default function Route() {
  useEffect(() => {
    const logoutProcess = async () => {
      Cookies.set("idToken", "");
      Cookies.set("accessToken", "");
      window.location.href = `${USER_POOL_DOMAIN}/logout?client_id=${OKTA_APP_CLIENT_ID}&logout_uri=${encodeURI(
        `https://${APP_DOMAIN}`
      )}&redirect_uri=${encodeURI(
        `https://${APP_DOMAIN}`
      )}&response_type=token`;
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
