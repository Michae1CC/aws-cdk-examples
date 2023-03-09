import express from "express";

export function apiRoutes() {
  const routes = express.Router();

  routes.get("/uppercase", (req: any, res: any) => {
    const input: string = req?.query?.input ?? "default";
    const result = input.toLocaleUpperCase();
    console.log(`result of ${result}`);
    res.status(200).json({ result: result });
  });

  routes.get("/lowercase", (req: any, res: any) => {
    const input: string = req?.query?.input ?? "default";
    const result = input.toLocaleLowerCase();
    console.log(`result of ${result}`);
    res.status(200).json({ result: result });
  });

  routes.get("/capitalize", (req: any, res: any) => {
    const input: string = req?.query?.input ?? "default";
    const result =
      input.charAt(0).toLocaleUpperCase() + 
        input.substring(1).toLocaleLowerCase();
    console.log(`result of ${result}`);
    res.status(200).json({ result: result });
  });

  return routes;
}
