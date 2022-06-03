import type { CookieSerializeOptions } from 'cookie';
import { decode } from '../../shared/type-handlers';
import type { RPCError } from '../../shared/error';
import { noMethodSpecified } from '../../shared/error-creators';
import type { RPCSerializableValue } from '../../shared/types';

export type EnvironmentHelpers = {
  setCookie: (name: string, value: string, options: CookieSerializeOptions | undefined) => void;
  readCookie: (name: string) => string | undefined;
  clearCookie: (name: string) => void;
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
      return { name: methodDetails.name, input: methodDetails.input ? decode(methodDetails.input) : null };
    }

    throw noMethodSpecified(`Method ${methodDetails.name} is not allowed as a GET request`);
  }

  const { method, input } = decode(await postBody());

  if (method === null) throw noMethodSpecified('Couldn\'t parse method from post body');
  return { name: method, input };
};
