// eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-redeclare
import fetch from 'node-fetch';
import type { RPCSerializableValue } from './shared';

export const createClient = <T>({ url }: { url: string }) => new Proxy({}, {
  get: (target, prop) => (input: RPCSerializableValue) => {
    // eslint-disable-next-line no-console
    console.log('Invoking', prop, input);

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ method: prop, input })
    }).then(res => res.json());
  }
}) as T;
