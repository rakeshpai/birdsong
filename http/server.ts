import type { MaybeAsync, RPCSerializableValue, Validator } from '../core/shared';

type RuntimeHelpers = {
  setCookie: (name: string, value: string) => void;
  methodName: string;
  input: unknown;
  readCookie: (name: string) => string | undefined;
};

type HttpResolverArgsWithContext<
  Context,
  Input extends RPCSerializableValue,
> = [
  input: Input,
  helpers: Pick<RuntimeHelpers, 'setCookie' | 'readCookie'> & { context: Context }
];

type HttpResolverArgsWithoutContext<
  Input extends RPCSerializableValue,
> = [input: Input, helpers: Pick<RuntimeHelpers, 'setCookie' | 'readCookie'>];

type HttpResolverWithContext<
  Context,
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = (...args: HttpResolverArgsWithContext<Context, Input>) => MaybeAsync<Output>;

type HttpResolverWithoutContext<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = (...args: HttpResolverArgsWithoutContext<Input>) => MaybeAsync<Output>;

type HttpServiceMethodDescriptorWithContext<
  Context,
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = {
  validator: Validator<Input>;
  resolver: HttpResolverWithContext<Context, Input, Output>;
};

type HttpServiceMethodDescriptorWithoutContext<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = {
  validator: Validator<Input>;
  resolver: HttpResolverWithoutContext<Input, Output>;
};

type MethodWithoutContext = <Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  validator: Validator<Input>,
  resolver: HttpResolverWithoutContext<Input, Output>
) => HttpServiceMethodDescriptorWithoutContext<Input, Output>;

type MethodForContext<Context> = <Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  validator: Validator<Input>,
  resolver: HttpResolverWithContext<Context, Input, Output>
) => HttpServiceMethodDescriptorWithContext<Context, Input, Output>;

const methodForContext = <Context>() => <Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  validator: Validator<Input>,
  resolver: HttpResolverWithContext<Context, Input, Output>
): HttpServiceMethodDescriptorWithContext<Context, Input, Output> => ({ validator, resolver });

const methodWithoutContext = <Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  validator: Validator<Input>,
  resolver: HttpResolverWithoutContext<Input, Output>
): HttpServiceMethodDescriptorWithoutContext<Input, Output> => ({ validator, resolver });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HttpServerOptionsWithContext<Context, Service, RuntimeArgs extends any[]> = {
  createContext: (helpers: Omit<RuntimeHelpers, 'methodName' | 'input'>) => Context;
  service: (method: MethodForContext<Context>) => (
    Service extends {
      [methodName in keyof Service]: Service[methodName] extends HttpServiceMethodDescriptorWithContext<Context, infer Input, infer Output>
        ? HttpServiceMethodDescriptorWithContext<Context, Input, Output>
        : never
    }
      ? Service
      : never
  );
  environment: (...args: RuntimeArgs) => RuntimeHelpers;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HttpServerOptionsWithoutContext<Service, RuntimeArgs extends any[]> = {
  service: (method: MethodWithoutContext) => (
    Service extends {
      [methodName in keyof Service]: Service[methodName] extends HttpServiceMethodDescriptorWithoutContext<infer Input, infer Output>
        ? HttpServiceMethodDescriptorWithoutContext<Input, Output>
        : never
    }
      ? Service
      : never
  );
  environment: (...args: RuntimeArgs) => RuntimeHelpers;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HttpServerReturnType<RuntimeArgs extends any[], Methods> = {
  server: (...args: RuntimeArgs) => MaybeAsync<RPCSerializableValue>;
  methods: {
    [methodName in keyof Methods]:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Methods[methodName] extends HttpServiceMethodDescriptorWithContext<any, infer Input, infer Output>
      ? (input: Input) => Promise<Output>
      : Methods[methodName] extends HttpServiceMethodDescriptorWithoutContext<infer Input, infer Output>
        ? (input: Input) => Promise<Output>
        : never

  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function httpServer<Context, Service, RuntimeArgs extends any[]>(
  options: HttpServerOptionsWithContext<Context, Service, RuntimeArgs>
): HttpServerReturnType<RuntimeArgs, Service>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function httpServer<Service, RuntimeArgs extends any[]>(
  options: HttpServerOptionsWithoutContext<Service, RuntimeArgs>
): HttpServerReturnType<RuntimeArgs, Service>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function httpServer<Context, Service, RuntimeArgs extends any[]>(
  options: HttpServerOptionsWithContext<Context, Service, RuntimeArgs> | HttpServerOptionsWithoutContext<Service, RuntimeArgs>
) {
  const methods = ('createContext' in options)
    ? options.service(methodForContext<Context>())
    : options.service(methodWithoutContext);

  type MethodsClientType = {
    [key in keyof Service]:
    Service[key] extends MethodWithoutContext | MethodForContext<Context>
      ? (input: ReturnType<ReturnType<Service[key]>['validator']>)
      => Promise<ReturnType<ReturnType<Service[key]>['resolver']>>
      : never
  };

  return {
    server: async (...args: RuntimeArgs) => {
      const {
        methodName, input, setCookie, readCookie
      } = options.environment(...args);
      const method = methods[methodName as keyof typeof methods];
      if (!method) {
        throw new Error(`Method '${methodName}' not found`);
      }

      return ('createContext' in options)
        ? method.resolver(await method.validator(input), {
          context: options.createContext({ setCookie, readCookie }),
          setCookie,
          readCookie
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : (method.resolver as HttpResolverWithoutContext<any, any>)(await method.validator(input), {
          setCookie, readCookie
        });
    },
    methods: {} as MethodsClientType
  };
}

export default httpServer;

export type ClientType<T> = { [methodName in keyof T]: T[methodName] };
