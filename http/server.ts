import type { MaybeAsync, RPCSerializableValue, Validator } from '../core/shared';
import type { RPCError } from './errors';
import { badRequest, internalServerError, methodNotFound } from './errors';
import type { Environment, EnvironmentHelpers } from './types';

type HttpResolverArgsWithContext<
  Context,
  Input extends RPCSerializableValue,
> = [
  input: Input,
  helpers: Pick<EnvironmentHelpers, 'setCookie' | 'readCookie'> & { context: Context }
];

type HttpResolverArgsWithoutContext<
  Input extends RPCSerializableValue,
> = [input: Input, helpers: Pick<EnvironmentHelpers, 'setCookie' | 'readCookie'>];

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
  createContext: (helpers: Pick<EnvironmentHelpers, 'setCookie' | 'readCookie'>) => Context;
  service: (method: MethodForContext<Context>) => (
    Service extends {
      [methodName in keyof Service]: Service[methodName] extends HttpServiceMethodDescriptorWithContext<Context, infer Input, infer Output>
        ? HttpServiceMethodDescriptorWithContext<Context, Input, Output>
        : never
    }
      ? Service
      : never
  );
  environment: Environment<RuntimeArgs>;
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
  environment: Environment<RuntimeArgs>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HttpServerReturnType<RuntimeArgs extends any[], Methods> = {
  server: (...args: RuntimeArgs) => void;
  clientStub: {
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
        methodDetails, setCookie, readCookie, sendError, sendResponse
      } = options.environment(...args);

      let md: {
        name: string | null;
        input: unknown;
      };
      try {
        // eslint-disable-next-line prefer-const
        md = await methodDetails();
      } catch (e) {
        return sendError(e as RPCError);
      }
      const { name: methodName, input } = md;
      const method = methods[methodName as keyof typeof methods];

      if (!method) {
        return sendError(methodNotFound(`Method not found: ${methodName}`));
      }

      let validatedInput: RPCSerializableValue;
      try {
        // eslint-disable-next-line prefer-const
        validatedInput = await method.validator(input);
      } catch (e) {
        return sendError(badRequest((e as Error).message));
      }

      let output: RPCSerializableValue;
      try {
        // eslint-disable-next-line prefer-const
        output = await (
          ('createContext' in options)
            ? method.resolver(validatedInput, {
              context: options.createContext({ setCookie, readCookie }),
              setCookie,
              readCookie
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : (method.resolver as HttpResolverWithoutContext<any, any>)(
              validatedInput,
              { setCookie, readCookie }
            )
        );
      } catch (e) {
        return sendError(internalServerError((e as Error).message));
      }

      sendResponse(JSON.stringify(output));
    },
    clientStub: {} as MethodsClientType
  };
}

export default httpServer;

export type ClientType<T> = { [methodName in keyof T]: T[methodName] };
