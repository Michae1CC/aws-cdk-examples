import express from "express";
import serverlessExpress from "@vendia/serverless-express";
import { apiRoutes } from "./api-routes";
export {};

const app = express()
  .use(express.urlencoded({ extended: false }))
  .use(express.json())
  .use(apiRoutes());

exports.handler = serverlessExpress({ app });
