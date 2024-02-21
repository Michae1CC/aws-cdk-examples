import { useContext, useEffect, useState } from "react";
import { JwtDecodedContext } from "~/utils/context";
import {
  APP_DOMAIN,
  OKTA_APP_CLIENT_ID,
  OKTA_ID_PROVIDER_NAME,
  REGION,
  USER_POOL_NAME,
} from "~/utils/envar";

export default function NavigationBar() {
  const jwtDecoded = useContext(JwtDecodedContext);

  const [userLoggedIn, setUserLoggedIn] = useState<boolean>(
    jwtDecoded !== undefined
  );

  const loginUrl = `https://${USER_POOL_NAME}.auth.${REGION}.amazoncognito.com/authorize?identity_provider=${encodeURIComponent(
    OKTA_ID_PROVIDER_NAME
  )}&client_id=${encodeURIComponent(
    OKTA_APP_CLIENT_ID
  )}&response_type=token&scope=aws.cognito.signin.user.admin+email+openid+phone&redirect_uri=http%3A%2F%2F${encodeURIComponent(
    APP_DOMAIN
  )}%2Flogin`;

  const logoutUrl = "/logout";

  useEffect(() => {
    setUserLoggedIn(jwtDecoded !== undefined);
  }, [jwtDecoded]);

  return (
    <div className="navbar">
      <div className="nav-elements">
        <ul>
          <li>
            <a href="/">Home</a>
          </li>
          {userLoggedIn && (
            <li>
              <a href="/create">Create</a>
            </li>
          )}
          <li>
            <a href={userLoggedIn ? logoutUrl : loginUrl}>
              {userLoggedIn ? "Logout" : "Login"}
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
