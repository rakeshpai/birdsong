import { createClient } from '../core/client';
import type { UserService } from './server';

const c = createClient<UserService>();
c.getUser({ userId: '2' });
c.saveUser({ userName: 'John' });
