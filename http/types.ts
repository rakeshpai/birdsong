import type { CookieSerializeOptions } from 'cookie';
import type { RPCSerializableValue } from '../core/shared';

export type EnvironmentHelpers = {
  setCookie: (name: string, value: string, options: CookieSerializeOptions | undefined) => void;
  methodDetails: () => Promise<{ name: string | null; input: unknown }>;
  readCookie: (name: string) => string | undefined;
  sendResponse: (output: RPCSerializableValue) => void;
  sendError: (error: Error, errorCode: number) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Environment<EnvironmentArgs extends any[]> = (
  (...args: EnvironmentArgs) => EnvironmentHelpers
);
