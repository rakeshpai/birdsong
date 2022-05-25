import { createClient } from '../core/client';
import type { UserService } from './server';

const c = createClient<UserService>({ url: 'http://localhost:9000/api' });
c.getUser({ userId: '2' }).then(x => console.log(x));
c.saveUser({ userName: 'John' }).then(x => console.log(x));
