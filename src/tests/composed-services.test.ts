/* eslint-disable @typescript-eslint/no-redeclare */
import { it, expect } from 'vitest';
import { setup } from './setup';
import { createService, noInput } from '../server';

it('should work with nested services', async () => {
  const { client, log, stopServer } = await setup(() => ({
    users: createService(method => ({
      getUser: method(
        input => input as { userId: number },
        ({ userId }) => `Found user ${userId}`
      )
    })),
    widgets: createService(method => ({
      listWidgets: method(
        noInput,
        () => ['w1', 'w2']
      )
    }))
  }));

  const result1 = await client.users.getUser({ userId: 1 });
  expect(result1).toBe('Found user 1');
  expect(log.length).toBe(1);
  expect(log[0].options.method?.toLowerCase()).toBe('get');

  const result2 = await client.widgets.listWidgets();
  expect(result2).toEqual(['w1', 'w2']);
  expect(log.length).toBe(2);
  expect(log[1].options.method?.toLowerCase()).toBe('get');

  await stopServer();
});

it('should work with even more nested services', async () => {
  const { client, log, stopServer } = await setup(() => ({
    users: createService(() => ({
      auth: createService(() => ({
        passwordReset: createService(method => ({
          resetPassword: {
            reset: method(
              input => input as { userId: number },
              ({ userId }) => `Password reset for ${userId}`
            )
          }
        }))
      }))
    }))
  }));

  const result = await client.users.auth.passwordReset.resetPassword.reset({ userId: 1 });
  expect(result).toBe('Password reset for 1');
  expect(log.length).toBe(1);
  expect(log[0].options.method?.toLowerCase()).toBe('post');

  await stopServer();
});
