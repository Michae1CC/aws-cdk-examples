import { useMemo, useState } from "react";
import axios from "axios";
import { useLocation } from "@remix-run/react";

export default function Route() {
  const location = useLocation();
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useMemo(async () => {
    const searchParameters = new URLSearchParams(location.hash);
    const accessTokenString =
      searchParameters.get("#access_token") ??
      searchParameters.get("access_token");
    setAccessToken(accessTokenString);
  }, [location.hash]);

  useMemo(async () => {
    if (accessToken !== null) {
      axios({
        method: "post",
        url: "/access",
        data: {
          accessToken: accessToken,
        },
      });
    }
  }, [accessToken]);

  return <div>redirecting</div>;
}
