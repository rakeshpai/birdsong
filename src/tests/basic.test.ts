/* eslint-disable @typescript-eslint/no-redeclare */
import { it, expect } from 'vitest';
import { expectType } from 'ts-expect';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import { noInput } from '../server/server';
import { createClient } from '../client/client';
import { RPCError } from '../shared/error';
import {
  isCouldntParseRequest,
  isInternalServerError, isRPCError, isUnauthorized
} from '../shared/is-error';
import { couldntParseRequest, unauthorized } from '../shared/error-creators';
import type { FetchType } from './setup';
import { setup } from './setup';

it('should throw if server can\'t be reached', async () => {
  type DummyClientStub = {
    foo: () => Promise<void>;
  };

  const client = createClient<DummyClientStub>({
    url: 'http://localhost:4951/api',
    fetch: fetch as unknown as FetchType
  });

  expect.assertions(1);
  try {
    await client.foo(undefined);
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
  }
});

it('should make an rpc call (get + all the types)', async () => {
  const { client, log, stopServer } = await setup(method => ({
    getUser: method(
      async value => value as { id: number },
      ({ id }) => ({
        id,
        name: 'John Doe',
        dateOfBirth: new Date('1980-01-01'),
        validateNum: /^\d+$/,
        personal: {
          interests: new Set(['Coding', 'Reading', 'Sleeping']),
          social: new Map([
            ['twitter', '@john_doe'],
            ['github', 'john_doe']
          ])
        }
      })
    )
  }));

  const result = await client.getUser({ id: 1 });
  expectType<{
    id: number;
    name: string;
    dateOfBirth: Date;
    validateNum: RegExp;
    personal: {
      interests: Set<string>;
      social: Map<string, string>;
    };
  }>(result);
  expect(result).toMatchSnapshot();
  expect(result.validateNum.test('1234')).toBe(true);
  expect(result.validateNum.test('john@doe')).toBe(false);
  expect(log.length).toBe(1);
  expect(log[0].options.method?.toLowerCase()).toBe('get');

  await stopServer();
});

it('should make another rpc call (array get)', async () => {
  const { client, stopServer } = await setup(method => ({
    getUserTypes: method(
      noInput,
      () => ['home', 'work', 'other']
    )
  }));

  const result = await client.getUserTypes();
  expectType<string[]>(result);
  expect(result).toMatchSnapshot();

  await stopServer();
});

it('should make yet another rpc call (post)', async () => {
  const { client, stopServer, log } = await setup(method => ({
    saveUser: method(
      async value => value as { name: string },
      async ({ name }) => `'${name}' saved`
    )
  }));

  const result = await client.saveUser({ name: 'John Doe' });
  expectType<string>(result);
  expect(result).toMatchSnapshot();

  expect(log.length).toBe(1);
  expect(log[0].options.method?.toLowerCase()).toBe('post');

  await stopServer();
});

it('should throw in case of http error', async () => {
  const { client, stopServer } = await setup(method => ({
    accessSecret: method(
      value => value as { name: string },
      async ({ name }) => {
        throw unauthorized(`'${name}' is not authorized`);
      }
    )
  }));

  expect.assertions(5);
  try {
    await client.accessSecret({ name: 'John Doe' });
  } catch (e) {
    expect(isUnauthorized(e)).toBe(true);
    expect(isRPCError(e)).toBe(true);
    if (e instanceof RPCError) {
      expect(e.message).toEqual("'John Doe' is not authorized");
      expect(e.type).toEqual('Unauthorized');
      expect(e.statusCode).toBe(401);
    }
  }

  await stopServer();
});

it('should set a cookie', async () => {
  const { client, stopServer, log } = await setup(method => ({
    login: method(
      value => value as { username: string; password: string },
      async (input, { setCookie }) => {
        setCookie('token', '123456', { httpOnly: true });
        return 'Logged in';
      }
    )
  }));

  await client.login({ username: 'john', password: 'doe' });
  expect(log.length).toBe(1);
  expect((log[0].response as unknown as Response).headers.raw()['set-cookie']).toEqual([
    'token=123456; HttpOnly'
  ]);

  await stopServer();
});

it('should throw without details if server throws', async () => {
  const { client, stopServer } = await setup(method => ({
    throws: method(
      noInput,
      async () => { throw new Error('Barf'); }
    )
  }));

  expect.assertions(5);
  try {
    await client.throws();
  } catch (e) {
    expect(isInternalServerError(e)).toBe(true);
    expect(isRPCError(e)).toBe(true);
    if (e instanceof RPCError) {
      expect(e.message).toEqual('Internal server error');
      expect(e.type).toEqual('InternalServerError');
      expect(e.statusCode).toBe(500);
    }
  }

  await stopServer();
});

it('should receive client-side error in case of validation error', async () => {
  const { client, stopServer } = await setup(method => ({
    validationFails: method(
      // eslint-disable-next-line no-constant-condition, no-self-compare
      () => { if (1 === 1) throw couldntParseRequest('boo!'); },
      () => true
    )
  }));

  expect.assertions(5);
  try {
    await client.validationFails(undefined as never);
  } catch (e) {
    expect(isCouldntParseRequest(e)).toBe(true);
    expect(isRPCError(e)).toBe(true);
    if (e instanceof RPCError) {
      expect(e.message).toEqual('boo!');
      expect(e.type).toEqual('CouldntParseRequest');
      expect(e.statusCode).toBe(400);
    }
  }

  await stopServer();
});

it('should abort if a abort signal is received', async () => {
  const { client, stopServer } = await setup(method => ({
    login: method(
      value => value as { username: string; password: string },
      async (input, { setCookie }) => {
        setCookie('token', '123456', { httpOnly: true });
        return 'Logged in';
      }
    )
  }));

  const abortController = new AbortController();

  expect.assertions(2);
  try {
    const promise = client.login({ username: 'john', password: 'doe' }, { abortSignal: abortController.signal });
    abortController.abort();
    await promise;
  } catch (e) {
    if (e instanceof Error) {
      expect(e).toBeInstanceOf(Error);
      expect(e.name).toBe('AbortError');
    }
  }

  await stopServer();
});

it('should make calls with nested objects', async () => {
  const { client, stopServer } = await setup(method => ({
    bare: method(
      noInput,
      () => 'bare called'
    ),
    foo: {
      bar: method(
        noInput,
        async () => 'bar called'
      ),
      baz: {
        qux: method(
          noInput,
          async () => 'qux called'
        )
      },
      qux: {
        quux: {
          corge: method(
            noInput,
            async () => 'corge called'
          )
        }
      }
    },
    l1: {
      l2: {
        l3: {
          l4: {
            l5: {
              l6: method(
                value => value as string,
                async value => `${value} called`
              )
            }
          }
        }
      }
    }
  }));

  const result1 = await client.foo.bar();
  expectType<string>(result1);
  expect(result1).toBe('bar called');

  const result2 = await client.foo.baz.qux();
  expectType<string>(result2);
  expect(result2).toBe('qux called');

  const result3 = await client.foo.qux.quux.corge();
  expectType<string>(result3);
  expect(result3).toBe('corge called');

  const result4 = await client.l1.l2.l3.l4.l5.l6('foo');
  expectType<string>(result4);
  expect(result4).toBe('foo called');

  const result5 = await client.bare();
  expectType<string>(result5);
  expect(result5).toBe('bare called');

  await stopServer();
});
