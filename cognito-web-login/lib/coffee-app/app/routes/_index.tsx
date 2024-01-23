import type { MetaFunction, LinksFunction } from "@remix-run/node";

import stylesUrl from "~/styles/index.css";
import coffeeImage from "~/img/coffee_image.png";

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
        <div className="featured-picture-container">
          <div className="featured-picture">
            <img src={coffeeImage} alt={"Coffee"}></img>
            <h2>
              Pouring the Perfect Latte Art
            </h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam et venenatis risus. Integer at ipsum vehicula, laoreet enim a, varius purus. Cras at aliquam est, quis ultricies risus.
            </p>
          </div>
          <div className="featured-picture">
            <img src={coffeeImage} alt={"Coffee"}></img>
            <h2>
              Pouring the Perfect Latte Art
            </h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam et venenatis risus. Integer at ipsum vehicula, laoreet enim a, varius purus. Cras at aliquam est, quis ultricies risus.
            </p>
          </div>
          <div className="featured-picture">
            <img src={coffeeImage} alt={"Coffee"}></img>
            <h2>
              Pouring the Perfect Latte Art
            </h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam et venenatis risus. Integer at ipsum vehicula, laoreet enim a, varius purus. Cras at aliquam est, quis ultricies risus.
            </p>
          </div>
        </div>
        <div className="featured-list">
          Featured with list
        </div>
      </div>
    </div>
  );
}
