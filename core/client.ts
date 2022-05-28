// eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-redeclare
import fetch from 'node-fetch';
import type { RPCSerializableValue } from './shared';
import { encode, decode } from '../http/type-handlers';

const createGetUrl = (url: string, method: string, input: RPCSerializableValue) => {
  const u = new URL(url);
  u.searchParams.set('method', method);
  u.searchParams.set('input', encode(input));
  return u.toString();
};

const canMakeGetRequest = (url: string, method: string, input: RPCSerializableValue) => (
  (method.startsWith('get')
    || method.startsWith('list'))
  && createGetUrl(url, method, input).length < 1000
);

export const createClient = <T>({ url }: { url: string }) => new Proxy({}, {
  get: (target, prop) => (input: RPCSerializableValue) => {
    const methodName = prop as string;
    // eslint-disable-next-line no-console
    console.log(`Invoking method ${methodName} with input:`, input);

    const fetchOptions: Parameters<typeof fetch> = canMakeGetRequest(url, methodName, input)
      ? [createGetUrl(url, methodName, input), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }]
      : [url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: encode({ method: methodName, input })
      }];

    return fetch(...fetchOptions).then(res => res.text()).then(decode);
  }
}) as T;
