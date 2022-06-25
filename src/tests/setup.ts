/* eslint-disable import/no-extraneous-dependencies */
import getPort from 'get-port';
import http from 'node:http';
// eslint-disable-next-line @typescript-eslint/no-redeclare
import fetch from 'node-fetch';
import type { Logger } from '../client';
import { createClient } from '../client';
import httpServer from '../server';
import nodejs from '../server/environments/nodejs';
import type { Methods } from '../server/types';

export type FetchType = Parameters<typeof createClient>[0]['fetch'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setup = async <Service extends Record<string, any>>(
  methods: Methods<Service>
) => {
  const { server: rpcServer, clientStub } = httpServer({
    environment: nodejs,
    service: methods
  });

  const port = await getPort();

  const server: http.Server = await new Promise(resolve => {
    const s = http.createServer((req, res) => {
      if (req.url?.startsWith('/api')) return rpcServer(req, res);
    });
    s.listen(port, () => { resolve(s); });
  });

  const log: Parameters<Logger>[0][] = [];
  const client = createClient<typeof clientStub>({
    url: `http://localhost:${port}/api`,
    fetch: fetch as unknown as FetchType,
    logger: l => log.push(l)
  });

  return {
    stopServer: () => new Promise(resolve => { server.close(resolve); }),
    client,
    log
  };
};
