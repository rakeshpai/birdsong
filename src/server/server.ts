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

const method = <Context>() => <Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  validator: Validator<Input>,
  resolver: Resolver<Context, Input, Output>
): ServiceMethodDescriptor<Context, Input, Output> => ({ validator, resolver });

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServerOptions<Context, Service extends Record<string, ServiceMethodDescriptor<Context, any, any>>, RuntimeArgs extends any[]> =
  ServerOptionsBase & {
    createContext?: (helpers: EnvHelpers) => Context;
    service: (method: Method<Context>) => (
      Service extends {
        [methodName in keyof Service]: Service[methodName] extends ServiceMethodDescriptor<
          Context, infer Input, infer Output
        >
          ? ServiceMethodDescriptor<Context, Input, Output>
          : never
      }
        ? Service
        : never
    );
    environment: Environment<RuntimeArgs>;
  };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const httpServer = <Context, Service extends Record<string, ServiceMethodDescriptor<Context, any, any>>, RuntimeArgs extends any[]>(
  options: ServerOptions<Context, Service, RuntimeArgs>
) => {
  const methods = options.service(method<Context>());

  type MethodsClientType = Readonly<{
    [key in keyof Service]: (input: Awaited<ReturnType<Service[key]['validator']>>)
    => Promise<Awaited<ReturnType<Service[key]['resolver']>>>
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
    clientStub: {} as MethodsClientType
  };
};

export default httpServer;
