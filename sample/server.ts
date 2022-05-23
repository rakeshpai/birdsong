import type { ClientType } from '../http/server';
import httpServer from '../http/server';

const { methods } = httpServer({
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
  environment: () => {
    const cookies = new Map<string, string>();
    return {
      setCookie: (name, value) => cookies.set(name, value),
      readCookie: name => cookies.get(name),
      methodName: '',
      input: undefined
    };
  }
});

export type UserService = ClientType<typeof methods>;
