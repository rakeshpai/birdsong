import { createClient } from '../core/client';
import type { UserService } from './server';

const c = createClient<UserService>({ url: 'http://localhost:9000/api' });
// eslint-disable-next-line no-console
c.getUser({ userId: '2' }).then(x => console.log(x));
// eslint-disable-next-line no-console
c.saveUser({ userName: 'John' }).then(x => console.log(x));
// eslint-disable-next-line no-console
c.getUser({ userId: '123' }).then(console.log);
