import http from 'http';
import { parse } from 'url';
import { encode } from '../http/type-handlers';
import nodejs from '../http/environments/node';
import httpServer from '../http/server';

const { clientStub, server } = httpServer({
  logging: true,
  createContext: () => ({ isLoggedIn: true }),
  service: method => ({
    getUser: method(
      value => value as { userId: string },
      ({ userId }) => ({ id: userId, x: { date: new Date() }, foo: /user/ })
    ),
    saveUser: method(
      value => value as { userName: string },
      ({ userName }) => ({ name: userName })
    )
  }),
  environment: nodejs
});

http.createServer((req, res) => {
  // eslint-disable-next-line no-console
  console.log(req.method, req.url);
  if (!req.url) {
    res.statusCode = 400;
    res.end('No URL specified');
    return;
  }

  if (parse(req.url).pathname === '/api') return server(req, res);

  res.statusCode = 404;
  if (req.headers.accept?.includes('application/json')) {
    res.end(encode({ error: { message: 'Not found', type: 'NotFound' } }));
  } else {
    res.end('Not found');
  }
}).listen(9000);

export type UserService = typeof clientStub;
