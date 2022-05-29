/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-redeclare */
import {
  it, beforeAll, afterAll, expect
} from 'vitest';
import { expectType } from 'ts-expect';
import http from 'http';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import httpServer from '../server/server';
import node from '../server/environments/node';
import type { Logger } from '../client/client';
import { createClient } from '../client/client';
import {
  couldntParseRequest,
  isBadRequest,
  isInternalServerError, isRPCError, isUnauthorized, unauthorized
} from '../shared/errors';

const { server: rpcServer, clientStub } = httpServer({
  environment: node,
  service: method => ({
    getUser: method(
      value => value as { id: number },
      ({ id }) => ({
        id,
        name: 'John Doe',
        dateOfBirth: new Date('1980-01-01'),
        personal: {
          interests: new Set(['Coding', 'Reading', 'Sleeping']),
          social: new Map([
            ['twitter', '@john_doe'],
            ['github', 'john_doe']
          ])
        }
      })
    ),
    getUserTypes: method(
      value => value as number,
      () => ['home', 'work', 'other']
    ),
    saveUser: method(
      value => value as { name: string },
      async ({ name }) => `'${name}' saved`
    ),
    accessSecret: method(
      value => value as { name: string },
      async ({ name }) => {
        throw unauthorized(`'${name}' is not authorized`);
      }
    ),
    login: method(
      value => value as { username: string; password: string },
      async (input, { setCookie }) => {
        setCookie('token', '123456', { httpOnly: true });
        return 'Logged in';
      }
    ),
    throws: method(
      value => value as { name: string },
      async () => { throw new Error('Barf'); }
    ),
    validationFails: method(
      () => { throw couldntParseRequest('boo!'); },
      () => true
    )
  })
});

let server;

beforeAll(() => {
  server = http.createServer((req, res) => {
    if (req.url.startsWith('/api')) return rpcServer(req, res);
  }).listen(4949);
});

afterAll(() => {
  server.close();
});

type FetchType = Parameters<typeof createClient>[0]['fetch'];

it('should make an rpc call (get + types)', async () => {
  const log: Parameters<Logger>[0][] = [];
  const client = createClient<typeof clientStub>({
    url: 'http://localhost:4949/api',
    fetch: fetch as unknown as FetchType,
    logger: l => log.push(l)
  });

  const result = await client.getUser({ id: 1 });
  expectType<{
    id: number;
    name: string;
    dateOfBirth: Date;
    personal: {
      interests: Set<string>;
      social: Map<string, string>;
    };
  }>(result);
  expect(result).toMatchSnapshot();
  expect(log.length).toBe(1);
  expect(log[0].options.method.toLowerCase()).toBe('get');
});

it('should make another rpc call (array get)', async () => {
  const client = createClient<typeof clientStub>({
    url: 'http://localhost:4949/api',
    fetch: fetch as unknown as FetchType
  });

  const result = await client.getUserTypes(5);
  expectType<string[]>(result);
  expect(result).toMatchSnapshot();
});

it('should make yet another rpc call (post)', async () => {
  const log: Parameters<Logger>[0][] = [];
  const client = createClient<typeof clientStub>({
    url: 'http://localhost:4949/api',
    fetch: fetch as unknown as FetchType,
    logger: l => log.push(l)
  });

  const result = await client.saveUser({ name: 'John Doe' });
  expectType<string>(result);
  expect(result).toMatchSnapshot();

  expect(log.length).toBe(1);
  expect(log[0].options.method.toLowerCase()).toBe('post');
});

it('should throw in case of http error', async () => {
  const client = createClient<typeof clientStub>({
    url: 'http://localhost:4949/api',
    fetch: fetch as unknown as FetchType
  });

  expect.assertions(5);
  try {
    await client.accessSecret({ name: 'John Doe' });
  } catch (e) {
    expect(isUnauthorized(e)).toBe(true);
    expect(isRPCError(e)).toBe(true);
    expect(e.message).toEqual("'John Doe' is not authorized");
    expect(e.type).toEqual('Unauthorized');
    expect(e.statusCode).toBe(401);
  }
});

it('should set a cookie', async () => {
  const log: Parameters<Logger>[0][] = [];
  const client = createClient<typeof clientStub>({
    url: 'http://localhost:4949/api',
    fetch: fetch as unknown as FetchType,
    logger: l => log.push(l)
  });

  await client.login({ username: 'john', password: 'doe' });
  expect(log.length).toBe(1);
  expect((log[0].response as unknown as Response).headers.raw()['set-cookie']).toEqual([
    'token=123456'
  ]);
});

it('should throw without details if server throws', async () => {
  const client = createClient<typeof clientStub>({
    url: 'http://localhost:4949/api',
    fetch: fetch as unknown as FetchType
  });

  expect.assertions(5);
  try {
    await client.throws({ name: 'John Doe' });
  } catch (e) {
    expect(isInternalServerError(e)).toBe(true);
    expect(isRPCError(e)).toBe(true);
    expect(e.message).toEqual('Internal server error');
    expect(e.type).toEqual('InternalServerError');
    expect(e.statusCode).toBe(500);
  }
});

it('should receive client-side error in case of validation error', async () => {
  const client = createClient<typeof clientStub>({
    url: 'http://localhost:4949/api',
    fetch: fetch as unknown as FetchType
  });

  expect.assertions(5);
  try {
    await client.validationFails(undefined as never);
  } catch (e) {
    expect(isBadRequest(e)).toBe(true);
    expect(isRPCError(e)).toBe(true);
    expect(e.message).toEqual('boo!');
    expect(e.type).toEqual('BadRequest');
    expect(e.statusCode).toBe(400);
  }
});
