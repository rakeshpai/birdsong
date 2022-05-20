import { createClient } from '../core/client';
import type { UserService } from './server';

const c = createClient<UserService>();
c.getUser({ userId: '123' }).then(x => x);
c.getUserTypes(true).then(x => x);
