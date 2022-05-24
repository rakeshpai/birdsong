import nodejs from '../http/environments/node';
import type { ClientType } from '../http/server';
import httpServer from '../http/server';

const { methods, server } = httpServer({
  createContext: () => ({ isLoggedIn: true }),
  service: method => ({
    getUser: method(
      value => ({ userId: String(value) }),
      ({ userId }) => Promise.resolve({ id: userId })
    ),
    saveUser: method(
      value => ({ userName: String(value) }),
      ({ userName }) => Promise.resolve({ name: userName })
    )
  }),
  environment: nodejs
});

console.log(server);

export type UserService = ClientType<typeof methods>;
