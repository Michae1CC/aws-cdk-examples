import type { MetaFunction, LinksFunction } from "@remix-run/node";

import stylesUrl from "~/styles/index.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  return (
    <div>
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
      <div className="content-main">
        <h1>Welcome to Remix</h1>
        <div className="feature-picture">
          Featured with picture
        </div>
      </div>
    </div>
  );
}
