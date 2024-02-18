import type { LinksFunction } from "@remix-run/node";

import stylesUrl from "~/styles/index.css";
import { useEffect } from "react";
import Cookies from "js-cookie";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export default function Route() {
  useEffect(() => {
    const logoutProcess = async () => {
      Cookies.set("idToken", "");
      Cookies.set("accessToken", "");
      window.location.href =
        "https://testpoolauth01.auth.us-east-1.amazoncognito.com/logout?client_id=508cbe40iour98ka15km5c0uej&logout_uri=http%3A%2F%2Flocalhost:3000&redirect_uri=http%3A%2F%2Flocalhost:3000&response_type=token";
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
