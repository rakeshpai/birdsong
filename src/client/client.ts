/* global globalThis */
import type { RPCSerializableValue } from '../shared/types';
import { RPCError } from '../shared/error';
import { encode, decode } from '../shared/type-handlers';

const createGetUrl = (url: string, method: string, input: RPCSerializableValue) => {
  const u = new URL(url);
  u.searchParams.set('method', method);
  if (input !== undefined) u.searchParams.set('input', encode(input));
  return u.toString();
};

const canMakeGetRequest = (url: string, method: string, input: RPCSerializableValue) => (
  (method.startsWith('get')
    || method.startsWith('list'))
  && createGetUrl(url, method, input).length < 1000
);

const globalFetch = globalThis.fetch;
const appJson = 'application/json';

const fetchGetOptions = (url: string, methodName: string, input: RPCSerializableValue) => (
  [createGetUrl(url, methodName, input), {
    method: 'GET',
    headers: { 'Accept': appJson }
  }] as Parameters<typeof fetch>
);

const fetchPostOptions = (url: string, methodName: string, input: RPCSerializableValue) => (
  [url, {
    method: 'POST',
    headers: { 'Content-Type': appJson, 'Accept': appJson },
    body: encode({ method: methodName, input })
  }] as Parameters<typeof fetch>
);

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

export type Options = Partial<{
  abortSignal: AbortSignal;
}>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServerServiceType = Record<string, any>;

export type ClientType<ServiceDetails extends ServerServiceType> = Readonly<{
  // eslint-disable-next-line @typescript-eslint/ban-types
  [MethodName in keyof ServiceDetails]: ServiceDetails[MethodName] extends Function
    ? (
      input: Parameters<ServiceDetails[MethodName]>[0],
      options?: Options
    ) => ReturnType<ServiceDetails[MethodName]>
    : ClientType<ServiceDetails[MethodName]>
}>;

export const createClient = <T extends ServerServiceType>({ url, fetch = globalFetch, logger }: ClientOptions) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxyHandlerCache = new Map<string, ProxyHandler<any>>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getProxyHandler = (rootObj: any, path: string): ProxyHandler<any> => {
    if (proxyHandlerCache.has(path)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return proxyHandlerCache.get(path)!;
    }

    const handler = (prop: string) => {
      const innerHandler = async (input: RPCSerializableValue, options: Options = {}) => {
        const startTime = Date.now();
        const methodName = (path + (prop as string)).replace(/^\./, '');

        const [fetchUrl, fetchOpts] = (
          canMakeGetRequest(url, methodName, input)
            ? fetchGetOptions(url, methodName, input)
            : fetchPostOptions(url, methodName, input)
        );

        const fetchOptions = { ...fetchOpts, signal: options.abortSignal };

        const response = await fetch(fetchUrl, fetchOptions);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const log = (parsed: any) => logger?.({
          url: fetchUrl as string,
          options: fetchOptions as RequestInit,
          response,
          ok: response.ok,
          startTime,
          parsed
        });

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
      };

      return getProxyHandler(innerHandler, `${path}${prop}.`);
    };

    const proxy = new Proxy(rootObj, {
      get: (target, prop) => handler(prop as string)
    });

    proxyHandlerCache.set(path, proxy);
    return proxy;
  };

  return getProxyHandler({}, '') as ClientType<T>;
};
