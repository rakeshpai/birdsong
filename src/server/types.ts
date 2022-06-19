import type { CookieSerializeOptions } from 'cookie';
import type { MaybeAsync, RPCSerializableValue, Validator } from '../shared/types';

export type ContextBase<T extends { [key in keyof T]: T[key] } = Record<string, unknown>> = T;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Environment<EnvironmentArgs extends any[]> = (
  (...args: EnvironmentArgs) => RequestHandler
);

type MethodHelpers<Context extends ContextBase> = NextOptions<Context>;

type ResolverArgs<Input extends RPCSerializableValue, Context extends ContextBase> =
  [input: Input, helpers: MethodHelpers<Context>];

type Resolver<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue,
  Context extends ContextBase
> = (...args: ResolverArgs<Input, Context>) => MaybeAsync<Output>;

export type ServiceMethodDescriptor<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue,
  Context extends ContextBase
> = {
  validator: Validator<Input>;
  resolver: Resolver<Input, Output, Context>;
};

export type Method = <Input extends RPCSerializableValue, Output extends RPCSerializableValue, Context extends ContextBase>(
  validator: Validator<Input>,
  resolver: Resolver<Input, Output, Context>
) => ServiceMethodDescriptor<Input, Output, Context>;

export const method: Method = (validator, resolver) => ({ validator, resolver });

/* eslint-disable @typescript-eslint/no-explicit-any */
export type LogLine =
  | { type: 'error-parse-method-details'; error: unknown }
  | { type: 'method-description'; methodName: string | null; input: any }
  | { type: 'error-method-not-found'; methodName: string | null; input: any }
  | { type: 'error-validate-input'; input: any; error: unknown }
  | { type: 'error-resolve-method-rpc'; input: any; validatedInput: any; error: unknown }
  | { type: 'error-resolve-method-unknown'; input: any; validatedInput: any; error: unknown }
  | { type: 'method-output'; input: any; validatedInput: any; output: any }
  | { type: 'validation-passed'; methodName: string; input: any; validatedInput: any };
/* eslint-enable @typescript-eslint/no-explicit-any */

export type Service<TService> = (
  TService extends {
    [methodName in keyof TService]: TService[methodName] extends ServiceMethodDescriptor<
      infer Input, infer Output, infer Context
    >
      ? ServiceMethodDescriptor<Input, Output, Context>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : TService[methodName] extends Service<any>
        ? Service<TService[methodName]>
        : never
  }
    ? TService
    : never
);

export type Methods<TService> = (method: Method) => Service<TService>;

type ServerOptionsBase = {
  logger?: (log: LogLine) => void;
};

export type ServerOptions<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TService extends Record<string, ServiceMethodDescriptor<any, any, any> | Service<any>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RuntimeArgs extends any[]
> =
  ServerOptionsBase & {
    service: Methods<TService>;
    environment: Environment<RuntimeArgs>;
  };
