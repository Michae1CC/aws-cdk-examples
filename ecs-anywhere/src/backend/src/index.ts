import express, { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { StatusCodes } from 'http-status-codes';
import helmet from 'helmet';
import winston from 'winston';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import { apiRouter } from './api-router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));
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

app.use('/api', apiRouter);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.locals.logger.error(err);
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).send('Internal Server Error Occurred');
});

app
  .listen(PORT, () => {
    console.log('Server running at PORT: ', PORT);
  })
  .on('error', (error) => {
    // gracefully handle error
    throw new Error(error.message);
  });
