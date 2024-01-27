import type { MetaFunction, LinksFunction } from "@remix-run/node";

import NavigationBar from "~/components/NavigationBar";

import stylesUrl from "~/styles/index.css";
import coffeeImage from "~/img/coffee_image.png";
import coffeeImage2 from "~/img/coffee_image2.png";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
];

export const meta: MetaFunction = () => {
  return [
    { title: "Coffee App" },
    { name: "Michael Ciccotosto-Camp", content: "Tips for coffee enthusiasts" },
  ];
};

export default function Index() {
  return (
    <div>
      <NavigationBar />
      <div className="content-main">
        <div className="featured-picture-container">
          <div className="featured-picture">
            <img src={coffeeImage} alt={"Coffee"}></img>
            <h2>Pouring the Perfect Latte Art</h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam et
              venenatis risus. Integer at ipsum vehicula, laoreet enim a, varius
              purus. Cras at aliquam est, quis ultricies risus.
            </p>
          </div>
          <div className="featured-picture">
            <img src={coffeeImage2} alt={"Coffee"}></img>
            <h2>Different Styles of Coffee</h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam et
              venenatis risus. Integer at ipsum vehicula, laoreet enim a, varius
              purus. Cras at aliquam est, quis ultricies risus.
            </p>
          </div>
          <div className="featured-picture">
            <img src={coffeeImage} alt={"Coffee"}></img>
            <h2>Pouring the Perfect Latte Art</h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam et
              venenatis risus. Integer at ipsum vehicula, laoreet enim a, varius
              purus. Cras at aliquam est, quis ultricies risus.
            </p>
          </div>
        </div>
        <div className="featured-list">
          <h3>Featured</h3>
          <hr />
          <div className="featured-list-item">
            <h4>Title</h4>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing edivt. Nam et
              venenatis risus.
            </p>
          </div>
          <hr />
          <div className="featured-list-item">
            <h4>Title</h4>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing edivt. Nam et
              venenatis risus.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
