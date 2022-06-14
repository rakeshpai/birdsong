import type { CookieSerializeOptions } from 'cookie';
import { decode } from '../../shared/type-handlers';
import type { RPCError } from '../../shared/error';
import { badRequest, noMethodSpecified } from '../../shared/error-creators';
import type { MaybeAsync, RPCSerializableValue } from '../../shared/types';

export type EnvironmentHelpers = {
  httpMethod: string | undefined;
  methodDetailsIfGet: () => MaybeAsync<{
    name: string | undefined | null;
    input: string | undefined | null;
  }>;
  postBody: () => MaybeAsync<string>;
  setCookie: (name: string, value: string, options?: CookieSerializeOptions) => void;
  readCookie: (name: string) => string | undefined;
  clearCookie: (name: string) => void;
  setHeader: (name: string, value: string) => void;
  getHeader: (name: string) => string | undefined;
  sendResponse: (output: RPCSerializableValue) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendError: (error: RPCError<any>) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Environment<EnvironmentArgs extends any[]> = (
  (...args: EnvironmentArgs) => EnvironmentHelpers
);

const isGettable = (methodName: string) => (
  methodName.startsWith('get')
  || methodName.startsWith('list')
);

export const getMethodDetails = async (
  requestMethod: string | undefined,
  methodDetailsIfGet: () => MaybeAsync<{
    name: string | null | undefined;
    input: string | null | undefined;
  }>,
  postBody: () => MaybeAsync<string>
): Promise<{ name: string | null; input: unknown }> => {
  const methodDetailsFromGet = async () => {
    const { name, input } = await methodDetailsIfGet();
    if (name === null || name === undefined) throw noMethodSpecified('Couldn\'t parse method from URL');

    if (isGettable(name)) {
      try {
        const inp = input ? decode(input) : undefined;
        return { name, input: inp };
      } catch (e) {
        throw badRequest(`Couldn't parse input: ${(e as Error).message}`);
      }
    }

    throw noMethodSpecified(`Method ${name} is not allowed as a GET request`);
  };

  const methodDetailsFromPost = async () => {
    const { method, input } = decode(await postBody());

    if (method === null) {
      throw noMethodSpecified('Couldn\'t parse method from post body');
    }

    return { name: method, input };
  };

  if ((requestMethod || 'get').toLowerCase() === 'get') return methodDetailsFromGet();

  return methodDetailsFromPost();
};
