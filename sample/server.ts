import http from 'http';
// eslint-disable-next-line @typescript-eslint/no-redeclare
import { URL } from 'url';
import nodejs from '../http/environments/node';
import httpServer from '../http/server';

const { clientStub, server } = httpServer({
  createContext: () => ({ isLoggedIn: true }),
  service: method => ({
    getUser: method(
      value => value as { userId: string },
      ({ userId }) => ({ id: userId })
    ),
    saveUser: method(
      value => value as { userName: string },
      ({ userName }) => ({ name: userName })
    )
  }),
  environment: nodejs
});

http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end('No URL specified');
    return;
  }

  if (req.url === '/api') return server(req, res);

  res.statusCode = 404;
  res.end('Not found');
}).listen(9000);

export type UserService = typeof clientStub;
