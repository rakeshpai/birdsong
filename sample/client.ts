import { createClient } from '../core/client';
import fetch from 'node-fetch';
import type { UserService } from './server';

const c = createClient<UserService>({
  url: 'http://localhost:9000/api',
  fetch: fetch as unknown as typeof globalThis.fetch
});

// eslint-disable-next-line no-console
c.getUser({ userId: '2' }).then(x => console.log(x));
// eslint-disable-next-line no-console
c.saveUser({ userName: 'John' }).then(x => console.log(x));
// eslint-disable-next-line no-console
c.getUser({ userId: '123' }).then(console.log);
