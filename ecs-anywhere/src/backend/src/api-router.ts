import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { StatusCodes } from 'http-status-codes';
import { GetPasteSchema } from './schemas.js';
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
  res.status(StatusCodes.OK).json(await getPaste(requestBody.id, res.locals.logger));
  next();
});
