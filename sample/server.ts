import type { ClientType } from '../core/server';
import { withContext } from '../core/server';

const { query } = withContext(() => ({ isLoggedIn: true }));

const service = {
  getUser: query(
    value => ({ userId: String(value || '') }),
    ({ input, context }) => {
      // eslint-disable-next-line no-console
      console.log(input, context.isLoggedIn);
      return ({ firstName: 'John', lastName: 'Doe' });
    }
  ),
  getUserTypes: query(
    () => true,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ input, context }): 'a' | 'b' => 'a'
  )
};

export type UserService = ClientType<typeof service>;
