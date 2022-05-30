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

export type LogLine = {
  url: string;
  options: RequestInit;
  response: Response;
  ok: boolean;
  startTime: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsed: any;
};

export type Logger = (x: LogLine) => void;

export type ClientOptions = {
  url: string;
  fetch?: typeof globalFetch;
  logger?: Logger;
};

export const createClient = <T>({ url, fetch = globalFetch, logger }: ClientOptions) => (
  new Proxy({}, {
    get: (target, prop) => async (input: RPCSerializableValue) => {
      const startTime = Date.now();
      const methodName = prop as string;

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const log = (parsed: any) => {
        logger?.({
          url: fetchOptions[0] as string,
          options: fetchOptions[1] as RequestInit,
          response,
          ok: response.ok,
          startTime,
          parsed
        });
      };

      if (!response.ok) {
        const error = await response.json();

        log(error);

        if (error?.error?.type && error?.error?.message) {
          throw new RPCError(error.error.type, error.error.message, response.status);
        } else {
          throw new Error(error);
        }
      }

      const result = decode(await response.text());

      log(result);
      return result;
    }
  }) as T
);
