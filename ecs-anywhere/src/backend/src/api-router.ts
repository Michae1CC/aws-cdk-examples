import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { StatusCodes } from 'http-status-codes';
import { GetPasteSchema, PutPasteSchema } from './schemas.js';
import { getPaste } from './controllers.js';

export const apiRouter = express.Router();

// Allow any origin to use the api routes
apiRouter.use(
  helmet.crossOriginResourcePolicy({
    policy: 'cross-origin'
  })
);

/**
 * curl -i -X POST --header "Content-type: application/json" -d '{"id":"hi"}' http://127.0.0.1:5000/api/get_paste
 */
apiRouter.post('/get_paste', async (req, res, next) => {
  const requestBody = GetPasteSchema.parse(req.body);
  // For errors returned from async functions invoked by route handlers and
  // middleware, you must pass them to the `next` function
  try {
    res.status(StatusCodes.OK).json(await getPaste(requestBody.id, res.locals.logger));
  } catch (e) {
    next(e);
  }
  next();
});

apiRouter.post('/put_paste', async (req, res, next) => {
  const requestBody = PutPasteSchema.parse(req.body);
  console.log(requestBody);
  next();
});
