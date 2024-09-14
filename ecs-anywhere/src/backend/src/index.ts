import express, { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import helmet from 'helmet';

const PORT = 3000;

// configures dotenv to work in your application
const app = express();

app.use(helmet());

app.use((req, res, next) => {
  res.locals.cspNonce = randomBytes(16).toString('hex');

  const cspMiddleWare = helmet.contentSecurityPolicy({
    directives: {
      'connect-src': null,
      'frame-src': null,
      'script-src': null,
      'script-src-elem': null,
      'script-src-attr': null,
      'style-src': ["'self'", `'nonce-${res.locals.cspNonce}'`]
    }
  });

  cspMiddleWare(req, res, next);
});

app.get('/', (request: Request, response: Response) => {
  response.status(200).send('Hello World');
});

app
  .listen(PORT, () => {
    console.log('Server running at PORT: ', PORT);
  })
  .on('error', (error) => {
    // gracefully handle error
    throw new Error(error.message);
  });
