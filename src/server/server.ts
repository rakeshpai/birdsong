import type { MaybeAsync, RPCSerializableValue, Validator } from '../shared/types';
import { encode } from '../shared/type-handlers';
import type { RPCError } from '../shared/error';
import { isRPCError } from '../shared/is-error';
import { badRequest, internalServerError, methodNotFound } from '../shared/error-creators';
import type { Environment, EnvironmentHelpers } from './environments/helpers';

type EnvHelpers = Pick<EnvironmentHelpers, 'setCookie' | 'readCookie' | 'clearCookie'>;

type HttpResolverArgsWithContext<
  Context,
  Input extends RPCSerializableValue,
> = [
  input: Input,
  helpers: EnvHelpers & { context: Context }
];

type HttpResolverArgsWithoutContext<
  Input extends RPCSerializableValue,
> = [input: Input, helpers: EnvHelpers];

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

export type MethodWithoutContext = <Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  validator: Validator<Input>,
  resolver: HttpResolverWithoutContext<Input, Output>
) => HttpServiceMethodDescriptorWithoutContext<Input, Output>;

export type MethodForContext<Context> = <Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
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

/* eslint-disable @typescript-eslint/no-explicit-any */
export type LogLine =
  | { type: 'error-parse-method-details'; error: unknown }

  | { type: 'method-description'; methodName: string | null; input: any }

  | { type: 'error-method-not-found'; methodName: string | null; input: any }

  | { type: 'error-validate-input'; input: any; error: unknown }
  | {
    type: 'error-resolve-method-rpc'; input: any; validatedInput: any; error: unknown;
  }
  | {
    type: 'error-resolve-method-unknown'; input: any; validatedInput: any; error: unknown;
  }
  | {
    type: 'method-output'; input: any; validatedInput: any; output: any;
  }
  | {
    type: 'validation-passed'; methodName: string; input: any; validatedInput: any;
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

type HttpServerOptionsBase = {
  logger?: (log: LogLine) => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HttpServerOptionsWithContext<Context, Service, RuntimeArgs extends any[]> =
  HttpServerOptionsBase & {
    createContext: (helpers: EnvHelpers) => Context;
    service: (method: MethodForContext<Context>) => (
      Service extends {
        [methodName in keyof Service]: Service[methodName] extends HttpServiceMethodDescriptorWithContext<
          Context, infer Input, infer Output
        >
          ? HttpServiceMethodDescriptorWithContext<Context, Input, Output>
          : never
      }
        ? Service
        : never
    );
    environment: Environment<RuntimeArgs>;
  };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HttpServerOptionsWithoutContext<Service, RuntimeArgs extends any[]> =
  HttpServerOptionsBase & {
    service: (method: MethodWithoutContext) => (
      Service extends {
        [methodName in keyof Service]: Service[methodName] extends HttpServiceMethodDescriptorWithoutContext<
          infer Input, infer Output
        >
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
        setCookie, readCookie, clearCookie, methodDetails,
        sendError, sendResponse, setHeader
      } = options.environment(...args);

      let md: {
        name: string | null;
        input: unknown;
      };
      try {
        // eslint-disable-next-line prefer-const
        md = await methodDetails();
      } catch (e) {
        options.logger?.({ type: 'error-parse-method-details', error: e });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return sendError(e as RPCError<any>);
      }
      const { name: methodName, input } = md;
      options.logger?.({ type: 'method-description', methodName, input });

      const method = methods[methodName as keyof typeof methods];

      if (!method) {
        options.logger?.({ type: 'error-method-not-found', methodName, input });
        return sendError(methodNotFound(`Method not found: ${methodName}`));
      }

      let validatedInput: RPCSerializableValue;
      try {
        // eslint-disable-next-line prefer-const
        validatedInput = await method.validator(input);
      } catch (e) {
        options.logger?.({ type: 'error-validate-input', input, error: e });
        return sendError(badRequest((e as Error).message));
      }

      options.logger?.({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        type: 'validation-passed', methodName: methodName!, input, validatedInput
      });

      let output: RPCSerializableValue;
      try {
        // eslint-disable-next-line prefer-const
        output = await (
          ('createContext' in options)
            ? method.resolver(validatedInput, {
              context: options.createContext({ setCookie, readCookie, clearCookie }),
              setCookie,
              readCookie,
              clearCookie
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : (method.resolver as HttpResolverWithoutContext<any, any>)(
              validatedInput,
              { setCookie, readCookie, clearCookie }
            )
        );
      } catch (e) {
        if (isRPCError(e)) {
          options.logger?.({
            type: 'error-resolve-method-rpc', input, validatedInput, error: e
          });
          sendError(e);
        } else {
          options.logger?.({
            type: 'error-resolve-method-unknown', input, validatedInput, error: e
          });
          return sendError(internalServerError('Internal server error'));
        }
      }

      options.logger?.({
        type: 'method-output', input, validatedInput, output
      });
      setHeader('Content-Type', 'application/json');
      sendResponse(encode(output));
    },
    clientStub: {} as MethodsClientType
  };
}

export default httpServer;
