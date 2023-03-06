import * as express from "express";

function apiRoutes() {
  const routes = new express.Router();

  routes.get("/uppercase", (req: any, res: any) => {
    const input: string = req?.query?.input ?? "default";
    const result = input.toUpperCase();
    console.log(`result of ${result}`);
    res.status(200).json({ result: result });
  });

  routes.get("/lowercase", (req: any, res: any) => {
    const input: string = req?.query?.input ?? "default";
    const result = input.toLowerCase();
    console.log(`result of ${result}`);
    res.status(200).json({ result: result });
  });

  routes.get("/capitalize", (req: any, res: any) => {
    const input: string = req?.query?.input ?? "default";
    const result =
      input.charAt(0).toUpperCase() + input.substr(1).toLowerCase();
    console.log(`result of ${result}`);
    res.status(200).json({ result: result });
  });

  return routes;
}
