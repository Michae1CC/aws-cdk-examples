import type { LinksFunction } from "@remix-run/node";
import stylesUrl from "~/styles/index.css";
import { useContext, useEffect } from "react";
import Cookies from "js-cookie";
import { EnvContext } from "~/utils/context";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export default function Route() {
  const env = useContext(EnvContext);

  useEffect(() => {
    const logoutProcess = async () => {
      Cookies.set("idToken", "");
      Cookies.set("accessToken", "");

      const logoutUrl = `${env.USER_POOL_DOMAIN}/logout?client_id=${
        env.OKTA_APP_CLIENT_ID
      }&logout_uri=${encodeURIComponent(
        `https://${env.APP_DOMAIN}`
      )}&redirect_uri=${encodeURIComponent(
        `https://${env.APP_DOMAIN}`
      )}&response_type=token`;

      console.log("Logout URL");
      console.log(logoutUrl);

      window.location.href = logoutUrl;
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
