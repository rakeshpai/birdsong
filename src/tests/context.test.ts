/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/no-redeclare */
import { expect, it } from 'vitest';
import http from 'http';
import type { Response } from 'node-fetch';
import fetch from 'node-fetch';
import httpServer from '../server/server';
import nodejs from '../server/environments/node';
import { createClient } from '../client/client';
import type { Logger } from '../client/client';

type FetchType = Parameters<typeof createClient>[0]['fetch'];

it.skip('should handle context correctly', async () => {
  const { server: rpcServer, clientStub } = httpServer({
    environment: nodejs,
    service: method => ({
      getUser: method(
        async value => value as { id: number },
        ({ id }) => ({
          id,
          name: 'John Doe'
        })

      )
    })
  });

  const server: http.Server = await new Promise(resolve => {
    const s = http.createServer((req, res) => {
      if (req.url?.startsWith('/api')) return rpcServer(req, res);
    });
    s.listen(4952, () => { resolve(s); });
  });

  const log: Parameters<Logger>[0][] = [];
  const client = createClient<typeof clientStub>({
    url: 'http://localhost:4952/api',
    fetch: fetch as unknown as FetchType,
    logger: l => log.push(l)
  });

  const stopServer = () => server.close();

  await client.getUser({ id: 1 });

  expect(log.length).toBe(1);
  expect((log[0].response as unknown as Response).headers.raw()['set-cookie']).toEqual([
    'token=1234'
  ]);

  stopServer();
});
