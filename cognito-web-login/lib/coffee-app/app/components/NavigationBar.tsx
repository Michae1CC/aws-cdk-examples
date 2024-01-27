import type { LinksFunction } from "@remix-run/node";

import navigationBarStylesUrl from "~/styles/NavigationBar.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: navigationBarStylesUrl },
];

export default function NavigationBar() {
  return (
    <div className="navbar">
      <div className="nav-elements">
        <ul>
          <li>
            <a href="/">Home</a>
          </li>
          <li>
            <a href="/">Edit</a>
          </li>
          <li>
            <a href="/">Login</a>
          </li>
        </ul>
      </div>
    </div>
  );
}
