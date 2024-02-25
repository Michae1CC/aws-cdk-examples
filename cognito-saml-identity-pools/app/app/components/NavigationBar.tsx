import { useContext, useEffect, useState } from "react";
import { JwtDecodedContext } from "~/utils/context";
import {
  APP_DOMAIN,
  OKTA_APP_CLIENT_ID,
  USER_POOL_DOMAIN,
} from "~/utils/envar";

export default function NavigationBar() {
  const jwtDecoded = useContext(JwtDecodedContext);

  const [userLoggedIn, setUserLoggedIn] = useState<boolean>(
    jwtDecoded !== undefined
  );

  const loginUrl = `${USER_POOL_DOMAIN}/oauth2/authorize?client_id=${OKTA_APP_CLIENT_ID}&response_type=token&scope=email+openid+profile&redirect_uri=http%3A%2F%2F${encodeURI(
    APP_DOMAIN
  )}/login`;

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
