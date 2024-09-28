import express, { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { StatusCodes } from 'http-status-codes';
import helmet from 'helmet';
import winston from 'winston';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import * as AWS from 'aws-sdk';
import * as AWSXRay from 'aws-xray-sdk';

import { apiRouter } from './api-router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

declare global {
  namespace Express {
    interface Locals {
      cspNonce: string;
      requestId: string;
      logger: winston.Logger;
    }
  }
}

const PORT = 3000;
const STATIC_FOLDER = path.join(__dirname, 'static');
const VIEWS_FOLDER = path.join(__dirname, 'static', 'views');

// AWS X-Ray
const DAEMON_ADDRESS = 'rpi1-3b:2000';
// Don't actually throw a error if we didn't initialise a segment.
AWSXRay.setContextMissingStrategy('LOG_ERROR');
// Dynamic name will override the above segment name if it matches.
AWS.config.update({ region: process.env.REGION || 'us-east-1' });
AWSXRay.setDaemonAddress(DAEMON_ADDRESS);

// configures dotenv to work in your application
const app = express();

// AWSXRay Logger
export const AWSXRayLogger = winston.createLogger({
  transports: [new winston.transports.Console()],
  format: winston.format.combine(
    winston.format.timestamp({
      format: () => {
        return new Date().toISOString();
      }
    }),
    winston.format.label({ label: 'AWSXray' }),
    winston.format.errors({ stack: true }),
    winston.format.align(),
    winston.format.json()
  )
});

AWSXRay.setLogger({
  error: (message) => {
    AWSXRayLogger.error(message);
  },
  warn: (message) => {
    AWSXRayLogger.warn(message);
  },
  // Info and debug logs aren't important and clutter the log streams.
  info: () => {},
  debug: () => {}
});

app.set('view engine', 'pug');
app.set('views', VIEWS_FOLDER);
app.set('trust proxy', true);
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(STATIC_FOLDER));
app.use(AWSXRay.express.openSegment('Paste'));
app.use((req, res, next) => {
  res.locals.cspNonce = randomBytes(16).toString('hex');

  const cspMiddleWare = helmet.contentSecurityPolicy({
    directives: {
      'frame-src': null,
      'script-src-elem': null,
      'script-src-attr': null,
      'connect-src': ['*'],
      'form-action': ["'self'"],
      'script-src': [`'nonce-${res.locals.cspNonce}'`],
      'style-src': [`'nonce-${res.locals.cspNonce}'`]
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

app.get('/', (req, res) => {
  console.log({ nonce: res.locals.cspNonce });
  res.render('index', { nonce: res.locals.cspNonce });
});

app.get('/view', (req, res) => {
  res.render('view', { nonce: res.locals.cspNonce });
});

app.use('/api', apiRouter);

app.use(AWSXRay.express.closeSegment());

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
