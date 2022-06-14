import type { MaybeAsync, RPCSerializableValue, Validator } from '../shared/types';
import { encode } from '../shared/type-handlers';
import type { RPCError } from '../shared/error';
import { isRPCError } from '../shared/is-error';
import { badRequest, internalServerError, methodNotFound } from '../shared/error-creators';
import type { Environment, EnvironmentHelpers } from './environments/helpers';
import { getMethodDetails } from './environments/helpers';
import type { Middleware, MiddlewareLike } from './middleware';
import { toMiddlewareList } from './middleware';

type EnvHelpers = Pick<EnvironmentHelpers, 'setCookie' | 'readCookie' | 'clearCookie'>;

type ResolverArgs<Input extends RPCSerializableValue> = [input: Input, helpers: EnvHelpers];

type Resolver<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = (...args: ResolverArgs<Input>) => MaybeAsync<Output>;

type ServiceMethodDescriptor<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = {
  middleware: Middleware<any, any>[];
  validator: Validator<Input>;
  resolver: Resolver<Input, Output>;
};

export type Method = <Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  validator: Validator<Input>,
  resolver: Resolver<Input, Output>
) => ServiceMethodDescriptor<Input, Output>;

function method<Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  validator: Validator<Input>,
  resolver: Resolver<Input, Output>
): ServiceMethodDescriptor<Input, Input>;
function method<Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  middleware: MiddlewareLike,
  validator: Validator<Input>,
  resolver?: Resolver<Input, Output>
): ServiceMethodDescriptor<Input, Output>;
function method<Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  middlewareOrValidator: Validator<Input> | MiddlewareLike,
  validatorOrResolver: Validator<Input> | Resolver<Input, Output>,
  maybeResolver?: Resolver<Input, Output>
): ServiceMethodDescriptor<Input, Output> {
  if (maybeResolver) {
    return {
      middleware: toMiddlewareList(middlewareOrValidator as MiddlewareLike),
      validator: validatorOrResolver as Validator<Input>,
      resolver: maybeResolver
    };
  }

  return {
    middleware: toMiddlewareList(middlewareOrValidator as MiddlewareLike),
    validator: middlewareOrValidator as Validator<Input>,
    resolver: validatorOrResolver as Resolver<Input, Output>
  };
}

// const method: Method = (validator, resolver) => ({ validator, resolver });

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

type ServerOptionsBase = {
  logger?: (log: LogLine) => void;
};

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
  const methods = options.service(method);

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

  const methodDetails = (env: EnvironmentHelpers) => {
    let methodDetailsCache: MaybeAsync<{
      name: string | null;
      input: unknown;
    }>;

    return () => {
      if (!methodDetailsCache) {
        methodDetailsCache = getMethodDetails(
          env.httpMethod,
          env.methodDetailsIfGet,
          env.postBody
        );
      }

      return methodDetailsCache;
    };
  };

  return {
    server: async (...args: RuntimeArgs) => {
      const env = options.environment(...args);
      const {
        setCookie, readCookie, clearCookie, sendError, sendResponse, setHeader
      } = env;

      const mDetails = methodDetails(env);

      let md: Awaited<ReturnType<typeof mDetails>>;
      try {
        // eslint-disable-next-line prefer-const
        md = await mDetails();
      } catch (e) {
        options.logger?.({ type: 'error-parse-method-details', error: e });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return sendError(e as RPCError<any>);
      }
      const { name: methodName, input } = md;
      options.logger?.({ type: 'method-description', methodName, input });

      if (methodName === null) {
        options.logger?.({ type: 'error-method-not-specified', input });
        return sendError(methodNotFound('Method not specified'));
      }

      const method = getMethod(methodName);

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
          method.resolver(validatedInput, {
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

export const noInput = (value: unknown) => (value as void);
