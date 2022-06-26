/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CookieSerializeOptions } from 'cookie';
import type { MaybeAsync, RPCSerializableValue, Validator } from '../shared/types';
import type { Middleware } from './middleware';

// export type ContextBase<T extends { [key in keyof T]: T[key] } = Record<string, unknown>> = T;
export type ContextBase = any;

export type NextOptionsBase = {
  request: Request;
  cookies: Record<string, string>;
  setCookie: (name: string, value: string, options?: CookieSerializeOptions) => void;
  deleteCookie: (name: string, options?: CookieSerializeOptions) => void;
};

export type NextOptions<Context extends ContextBase> = NextOptionsBase & { context: Context };

export type RequestHandler = {
  (next: (nextOptions: NextOptionsBase) => MaybeAsync<Response>): Promise<void>;
};

export type Environment<EnvironmentArgs extends any[]> = (
  (...args: EnvironmentArgs) => RequestHandler
);

type MethodHelpers<Context extends ContextBase> = NextOptions<Context>;

type ResolverArgs<Input extends RPCSerializableValue, Context extends ContextBase> =
  [input: Input, helpers: MethodHelpers<Context>];

export type Resolver<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue,
  Context extends ContextBase
> = (...args: ResolverArgs<Input, Context>) => MaybeAsync<Output>;

export type Method<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue,
  Context extends ContextBase,
  InContext extends ContextBase = Context
> = {
  type: 'method';
  middleware: Middleware<InContext, Context> | undefined;
  validator: Validator<Input>;
  resolver: Resolver<Input, Output, Context>;
};

export type MethodCreator = <Input extends RPCSerializableValue, Output extends RPCSerializableValue, Context extends ContextBase>(
  validator: Validator<Input>,
  resolver: Resolver<Input, Output, Context>
) => Method<Input, Output, Context>;

export type LogLine =
  | { type: 'error-parse-method-details'; error: unknown }
  | { type: 'method-description'; methodName: string | null; input: any }
  | { type: 'error-method-not-found'; methodName: string | null; input: any }
  | { type: 'error-validate-input'; input: any; error: unknown }
  | { type: 'error-resolve-method-rpc'; input: any; validatedInput: any; error: unknown }
  | { type: 'error-resolve-method-unknown'; input: any; validatedInput: any; error: unknown }
  | { type: 'method-output'; input: any; validatedInput: any; output: any }
  | { type: 'validation-passed'; methodName: string; input: any; validatedInput: any };

export type Service<Keys> = {
  type: 'service';
  keys: Keys extends {
    [key in keyof Keys]: Keys[key] extends Method<
      infer Input, infer Output, infer Context
    >
      ? Method<Input, Output, Context>
      : Keys[key] extends Service<any>
        ? Keys[key]
        : Keys[key] extends Service<any>['keys']
          ? Keys[key]
          : never
  } ? Keys : never;
};

export type Methods<TService> = (method: MethodCreator) => Service<TService>['keys'];

type ServerOptionsBase = {
  logger?: (log: LogLine) => void;
};

export type ServerOptions<
  TService extends Record<string, Method<any, any, any> | Service<any>>,
  RuntimeArgs extends any[]
> =
  ServerOptionsBase & {
    service: Methods<TService>;
    environment: Environment<RuntimeArgs>;
  };
