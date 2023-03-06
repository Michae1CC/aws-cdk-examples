import express from "express";
import { apiRoutes } from "./api-routes";

const app = express()
  .use(express.urlencoded({ extended: false }))
  .use(express.json())
  .use(apiRoutes());

const port = 80;

app.listen(port, () => console.log(`Listening on ${port}`));
