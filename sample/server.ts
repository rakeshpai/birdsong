import http from 'http';
import { parse } from 'url';
import nodejs from '../packages/http/server/environments/node';
import httpServer from '../packages/http/server';
import { encode } from '../packages/http/type-handlers';

const { clientStub, server } = httpServer({
  logging: true,
  createContext: () => ({ isLoggedIn: true }),
  service: method => ({
    getUser: method(
      value => value as { userId: string },
      ({ userId }) => ({
        id: userId,
        x: { date: new Date() },
        foo: /user/,
        map: new Map([['a', 'b']]),
        set: new Set(['a', 'b'])
      })
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
