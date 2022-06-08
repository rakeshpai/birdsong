import type { MaybeAsync, RPCSerializableValue, Validator } from '../shared/types';
import { encode } from '../shared/type-handlers';
import type { RPCError } from '../shared/error';
import { isRPCError } from '../shared/is-error';
import { badRequest, internalServerError, methodNotFound } from '../shared/error-creators';
import type { Environment, EnvironmentHelpers } from './environments/helpers';

type EnvHelpers = Pick<EnvironmentHelpers, 'setCookie' | 'readCookie' | 'clearCookie'>;

type ResolverArgs<Context, Input extends RPCSerializableValue> = [
  input: Input,
  helpers: EnvHelpers & { context: Context }
];

type Resolver<
  Context,
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = (...args: ResolverArgs<Context, Input>) => MaybeAsync<Output>;

type ServiceMethodDescriptor<
  Context,
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = {
  validator: Validator<Input>;
  resolver: Resolver<Context, Input, Output>;
};

export type Method<Context> = <Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  validator: Validator<Input>,
  resolver: Resolver<Context, Input, Output>
) => ServiceMethodDescriptor<Context, Input, Output>;

const method = <Context>(): Method<Context> => (validator, resolver) => ({ validator, resolver });

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

type ServerOptionsBase = {
  logger?: (log: LogLine) => void;
};

type Service<Context, TService> = (
  TService extends {
    [methodName in keyof TService]: TService[methodName] extends ServiceMethodDescriptor<
      Context, infer Input, infer Output
    >
      ? ServiceMethodDescriptor<Context, Input, Output>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : TService[methodName] extends Service<Context, any>
        ? Service<Context, TService[methodName]>
        : never
  }
    ? TService
    : never
);

export type Methods<Context, TService> = (method: Method<Context>) => Service<Context, TService>;

type ServerOptions<
  Context,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TService extends Record<string, ServiceMethodDescriptor<Context, any, any> | Service<Context, any>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RuntimeArgs extends any[]
> =
  ServerOptionsBase & {
    createContext?: (helpers: EnvHelpers) => Context;
    service: Methods<Context, TService>;
    environment: Environment<RuntimeArgs>;
  };

const httpServer = <
  Context,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TService extends Record<string, ServiceMethodDescriptor<Context, any, any> | Service<Context, any>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RuntimeArgs extends any[]
>(
  options: ServerOptions<Context, TService, RuntimeArgs>
) => {
  const methods = options.service(method<Context>());

  type MethodsClientType<TS> = Readonly<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key in keyof TS]: TS[key] extends ServiceMethodDescriptor<Context, any, any>
      ? (input: Awaited<ReturnType<TS[key]['validator']>>)
      => Promise<Awaited<ReturnType<TS[key]['resolver']>>>
      : MethodsClientType<TS[key]>
  }>;

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

      const createContext = options.createContext || (() => ({} as Context));
      let output: RPCSerializableValue;
      try {
        // eslint-disable-next-line prefer-const
        output = await (
          method.resolver(validatedInput, {
            context: createContext({ setCookie, readCookie, clearCookie }),
            setCookie,
            readCookie,
            clearCookie
          })
        );
      } catch (e) {
        if (isRPCError(e)) {
          options.logger?.({
            type: 'error-resolve-method-rpc', input, validatedInput, error: e
          });
          return sendError(e);
        }
        options.logger?.({
          type: 'error-resolve-method-unknown', input, validatedInput, error: e
        });
        return sendError(internalServerError('Internal server error'));
      }

      options.logger?.({
        type: 'method-output', input, validatedInput, output
      });
      setHeader('Content-Type', 'application/json');
      sendResponse(encode(output));
    },
    clientStub: {} as MethodsClientType<TService>
  };
};

export default httpServer;
