import express, { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { StatusCodes } from 'http-status-codes';
import helmet from 'helmet';
import winston from 'winston';
import { apiRouter } from './api-router.js';

declare global {
  namespace Express {
    interface Locals {
      requestId: string;
      logger: winston.Logger;
    }
  }
}

const PORT = 3000;

// configures dotenv to work in your application
const app = express();

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.locals.cspNonce = randomBytes(16).toString('hex');

  const cspMiddleWare = helmet.contentSecurityPolicy({
    directives: {
      'connect-src': null,
      'frame-src': null,
      'script-src': null,
      'script-src-elem': null,
      'script-src-attr': null,
      'form-action': ["'self'"],
      'style-src': ["'self'", `'nonce-${res.locals.cspNonce}'`]
    }
  });

  cspMiddleWare(req, res, next);
});

app.use((req, res, next) => {
  res.locals.requestId = uuidv4();
  res.locals.logger = winston.createLogger({
    transports: [new winston.transports.Console()],
    format: winston.format.combine(
      winston.format.timestamp({
        format: () => {
          return new Date().toISOString();
        }
      }),
      winston.format.label({ label: res.locals.requestId }),
      winston.format.errors({ stack: true }),
      winston.format.align(),
      winston.format.json()
    )
  });
  res.locals.logger.info(req.originalUrl);
  next();
});

app.get('/', (request: Request, response: Response) => {
  response.status(200).send('Hello World');
});

app.use('/api', apiRouter);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.locals.console.error(err);
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).send();
});

app
  .listen(PORT, () => {
    console.log('Server running at PORT: ', PORT);
  })
  .on('error', (error) => {
    // gracefully handle error
    throw new Error(error.message);
  });
