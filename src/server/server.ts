import type { MaybeAsync, RPCSerializableValue, Validator } from '../shared/types';
import { encode } from '../shared/type-handlers';
import { isRPCError } from '../shared/is-error';
import { badRequest, internalServerError, methodNotFound } from '../shared/error-creators';
import type { Environment, NextOptions } from './helpers';
import { methodDetails, errorResponse } from './helpers';

type EnvHelpers = NextOptions<any>;

type ResolverArgs<Input extends RPCSerializableValue> = [input: Input, helpers: EnvHelpers];

type Resolver<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = (...args: ResolverArgs<Input>) => MaybeAsync<Output>;

type ServiceMethodDescriptor<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = {
  validator: Validator<Input>;
  resolver: Resolver<Input, Output>;
};

export type Method = <Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  validator: Validator<Input>,
  resolver: Resolver<Input, Output>
) => ServiceMethodDescriptor<Input, Output>;

const method = (): Method => (validator, resolver) => ({ validator, resolver });

/* eslint-disable @typescript-eslint/no-explicit-any */
export type LogLine =
  | { type: 'error-parse-method-details'; error: unknown }
  | { type: 'method-description'; methodName: string | null; input: any }
  | { type: 'error-method-not-found'; methodName: string | null; input: any }
  | { type: 'error-method-not-specified'; input: any }
  | { type: 'error-validate-input'; input: any; error: unknown }
  | { type: 'error-resolve-method-rpc'; input: any; validatedInput: any; error: unknown }
  | { type: 'error-resolve-method-unknown'; input: any; validatedInput: any; error: unknown }
  | { type: 'method-output'; input: any; validatedInput: any; output: any }
  | { type: 'validation-passed'; methodName: string; input: any; validatedInput: any };
/* eslint-enable @typescript-eslint/no-explicit-any */

type ServerOptionsBase = {
  logger?: (log: LogLine) => void;
};

type Service<TService> = (
  TService extends {
    [methodName in keyof TService]: TService[methodName] extends ServiceMethodDescriptor<
      infer Input, infer Output
    >
      ? ServiceMethodDescriptor<Input, Output>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : TService[methodName] extends Service<any>
        ? Service<TService[methodName]>
        : never
  }
    ? TService
    : never
);

export type Methods<TService> = (method: Method) => Service<TService>;

type ServerOptions<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TService extends Record<string, ServiceMethodDescriptor<any, any> | Service<any>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RuntimeArgs extends any[]
> =
  ServerOptionsBase & {
    service: Methods<TService>;
    environment: Environment<RuntimeArgs>;
  };

const httpServer = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TService extends Record<string, ServiceMethodDescriptor<any, any> | Service<any>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RuntimeArgs extends any[]
>(
  options: ServerOptions<TService, RuntimeArgs>
) => {
  const methods = options.service(method());

  type MethodsClientType<TS> = Readonly<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key in keyof TS]: TS[key] extends ServiceMethodDescriptor<any, any>
      ? (input: Awaited<ReturnType<TS[key]['validator']>>)
      => Promise<Awaited<ReturnType<TS[key]['resolver']>>>
      : MethodsClientType<TS[key]>
  }>;

  const getMethod = (methodPath: string) => {
    const path = methodPath.split('.');
    let index = 0;
    let current = methods;

    while (index < path.length) {
      if (current[path[index]] === undefined) return undefined;
      current = current[path[index]];
      index += 1;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return current as unknown as ServiceMethodDescriptor<any, any>;
  };

  return {
    server: async (...args: RuntimeArgs) => {
      options.environment(...args)(async ({ request, ...rest }) => {
        let md;

        try {
          // eslint-disable-next-line prefer-const
          md = await methodDetails(request);
        } catch (e) {
          options.logger?.({ type: 'error-parse-method-details', error: e });
          return errorResponse(e);
        }

        const method = getMethod(md.method);

        if (!method) {
          options.logger?.({ type: 'error-method-not-found', methodName: md.method, input: md.input });
          return errorResponse(methodNotFound(`Method not found: ${md.method}`));
        }

        let validatedInput: RPCSerializableValue;
        try {
          // eslint-disable-next-line prefer-const
          validatedInput = await method.validator(md.input);
        } catch (e) {
          options.logger?.({ type: 'error-validate-input', input: md.input, error: e });
          return errorResponse(badRequest((e as Error).message));
        }

        options.logger?.({
          type: 'validation-passed', methodName: md.method, input: md.input, validatedInput
        });

        let output: RPCSerializableValue;
        try {
          // eslint-disable-next-line prefer-const
          output = await (
            method.resolver(validatedInput, { request, ...rest })
          );
        } catch (e) {
          if (isRPCError(e)) {
            options.logger?.({
              type: 'error-resolve-method-rpc', input: md.input, validatedInput, error: e
            });
            return errorResponse(e);
          }
          options.logger?.({
            type: 'error-resolve-method-unknown', input: md.input, validatedInput, error: e
          });
          return errorResponse(internalServerError('Internal server error'));
        }

        options.logger?.({
          type: 'method-output', input: md.input, validatedInput, output
        });

        return new Response(
          encode(output),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      });
    },
    clientStub: {} as MethodsClientType<TService>
  };
};

export default httpServer;

export const noInput = (value: unknown) => (value as void);
