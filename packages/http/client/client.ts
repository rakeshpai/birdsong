/* global globalThis */
import type { RPCSerializableValue } from '../../../common/types';
import { RPCError } from '../shared/errors';
import { encode, decode } from '../shared/type-handlers';

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

const globalFetch = globalThis.fetch;

type ClientOptions = {
  url: string;
  fetch?: typeof globalFetch;
};

export const createClient = <T>({ url, fetch = globalFetch }: ClientOptions) => new Proxy({}, {
  get: (target, prop) => async (input: RPCSerializableValue) => {
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

    const response = await fetch(...fetchOptions);

    if (!response.ok) {
      const error = await response.json();

      if (error?.error?.type && error?.error?.message) {
        throw new RPCError(error.error.type, error.error.message, response.status);
      } else {
        throw new Error(error);
      }
    }

    const result = decode(await response.text());

    return result;
  }
}) as T;
