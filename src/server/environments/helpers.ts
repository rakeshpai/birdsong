import type { CookieSerializeOptions } from 'cookie';
import { decode } from '../../shared/type-handlers';
import type { RPCError } from '../../shared/error';
import { badRequest, noMethodSpecified } from '../../shared/error-creators';
import type { RPCSerializableValue } from '../../shared/types';

export type EnvironmentHelpers = {
  setCookie: (name: string, value: string, options?: CookieSerializeOptions) => void;
  readCookie: (name: string) => string | undefined;
  clearCookie: (name: string) => void;
  setHeader: (name: string, value: string) => void;
  getHeader: (name: string) => string | undefined;
  methodDetails: () => Promise<{ name: string | null; input: unknown }>;
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
  requestMethod: string,
  methodDetails: { name: string | null; input: string | null },
  postBody: () => Promise<string>
): ReturnType<EnvironmentHelpers['methodDetails']> => {
  if (requestMethod.toLowerCase() === 'get') {
    if (methodDetails.name === null) throw noMethodSpecified('Couldn\'t parse method from URL');

    if (isGettable(methodDetails.name)) {
      try {
        const inp = methodDetails.input ? decode(methodDetails.input) : undefined;
        return { name: methodDetails.name, input: inp };
      } catch (e) {
        throw badRequest(`Couldn't parse input: ${(e as Error).message}`);
      }
    }

    throw noMethodSpecified(`Method ${methodDetails.name} is not allowed as a GET request`);
  }

  const { method, input } = decode(await postBody());

  if (method === null) throw noMethodSpecified('Couldn\'t parse method from post body');
  return { name: method, input };
};
