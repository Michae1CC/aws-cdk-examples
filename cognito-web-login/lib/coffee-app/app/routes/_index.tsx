import type { MetaFunction, LinksFunction } from "@remix-run/node";

import NavigationBar from "~/components/NavigationBar";
import FeaturedPicture from "~/components/FeaturedPicture";
import FeaturedList from "~/components/FeaturedList";

import stylesUrl from "~/styles/index.css";
import navigationBarStylesUrl from "~/styles/NavigationBar.css";
import featuredPictureStylesUrl from "~/styles/FeaturedPicture.css";
import featuredListStylesUrl from "~/styles/FeaturedList.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
  { rel: "stylesheet", href: navigationBarStylesUrl },
  { rel: "stylesheet", href: featuredPictureStylesUrl },
  { rel: "stylesheet", href: featuredListStylesUrl },
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
        <FeaturedPicture />
        <FeaturedList />
      </div>
    </div>
  );
}
