/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-redeclare */
import {
  it, beforeAll, afterAll, expect
} from 'vitest';
import { expectType } from 'ts-expect';
import http from 'http';
import fetch from 'node-fetch';
import httpServer from '../server/server';
import node from '../server/environments/node';
import { createClient } from '../client/client';
import { unauthorized } from '../shared/errors';

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

it('should make an rpc call', async () => {
  const client = createClient<typeof clientStub>({
    url: 'http://localhost:4949/api',
    fetch: fetch as unknown as FetchType
  });

  const result = await client.getUser({ id: 1 });
  expectType<{
    id: number;
    name: string;
    personal: {
      interests: Set<string>;
      social: Map<string, string>;
    };
    dateOfBirth: Date;
  }>(result);
  expect(result).toMatchSnapshot();
});

it('should make another rpc call', async () => {
  const client = createClient<typeof clientStub>({
    url: 'http://localhost:4949/api',
    fetch: fetch as unknown as FetchType
  });

  const result = await client.getUserTypes(5);
  expectType<string[]>(result);
  expect(result).toMatchSnapshot();
});

it('should make yet another rpc call', async () => {
  const client = createClient<typeof clientStub>({
    url: 'http://localhost:4949/api',
    fetch: fetch as unknown as FetchType
  });

  const result = await client.saveUser({ name: 'John Doe' });
  expectType<string>(result);
  expect(result).toMatchSnapshot();
});

it('should throw errors in case of http error', async () => {
  const client = createClient<typeof clientStub>({
    url: 'http://localhost:4949/api',
    fetch: fetch as unknown as FetchType
  });

  await expect(client.accessSecret({ name: 'John Doe' })).rejects.toThrow();
});
