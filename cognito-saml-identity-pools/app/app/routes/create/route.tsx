import type { LinksFunction } from "@remix-run/node";

import NavigationBar from "~/components/NavigationBar";
import Button from "~/components/Button";

import stylesUrl from "~/styles/index.css";
import navigationBarStylesUrl from "~/styles/NavigationBar.css";
import createStyles from "~/styles/create.css";
import buttonStyles from "~/styles/Button.css";
import { useCallback, useContext } from "react";
import {
  DynamoDbClientContext,
  EnvContext,
  JwtDecodedContext,
} from "~/utils/context";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import type { TableItem } from "~/types";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesUrl },
  { rel: "stylesheet", href: navigationBarStylesUrl },
  { rel: "stylesheet", href: createStyles },
  { rel: "stylesheet", href: buttonStyles },
];

export default function Route() {
  const ddb = useContext(DynamoDbClientContext);
  const env = useContext(EnvContext);
  const jwtDecoded = useContext(JwtDecodedContext);

  const submitCallback = useCallback(async () => {
    if (jwtDecoded === undefined || ddb === undefined) {
      return;
    }

    const description = (
      document.getElementsByClassName(
        "descriptionInput"
      )[0] as HTMLTextAreaElement
    ).value;

    const title = (
      document.getElementsByClassName("titleInput")[0] as HTMLInputElement
    ).value;

    const userEmail = jwtDecoded.email;
    if (userEmail === undefined) {
      return;
    }

    const item = {
      id: {
        S: crypto.randomUUID(),
      },
      email: {
        S: userEmail,
      },
      title: {
        S: title,
      },
      body: {
        S: description,
      },
    } satisfies TableItem;

    await ddb.send(
      new PutItemCommand({
        Item: item,
        TableName: env.TABLE_NAME,
      })
    );
    window.location.href = "/";
  }, [ddb, jwtDecoded, env]);

  return (
    <div>
      <NavigationBar />
      <div className="content-main">
        <div className="create-main">
          <h2>New Article</h2>
          <hr />
          <div className="property-edit">
            <h4>Title</h4>
            <input className="titleInput" type="text" />
          </div>
          <div className="property-edit">
            <h4>Content</h4>
            <textarea className="descriptionInput" />
          </div>
          <div className="property-edit">
            <Button text="Submit" callback={submitCallback}></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
