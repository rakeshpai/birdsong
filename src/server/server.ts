/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  MethodCreator, ServerOptions, Service, Method, Resolver
} from './types';
import processMethod from './process-method';
import type { RPCSerializableValue, Validator } from '../client';
import type { MiddlewareLike } from './middleware';
import { combineMiddleware } from './middleware';

function createMethod<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue,
  Context
>(
  validator: Validator<Input>,
  resolver: Resolver<Input, Output, Context>
): Method<Input, Input, Context>;
function createMethod<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue,
  Context,
  InContext = Context
>(
  middleware: MiddlewareLike<InContext, Context>,
  validator: Validator<Input>,
  resolver?: Resolver<Input, Output, Context>
): Method<Input, Output, Context>;
function createMethod<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue,
  Context,
  InContext = Context
>(
  middlewareOrValidator: Validator<Input> | MiddlewareLike<InContext, Context>,
  validatorOrResolver: Validator<Input> | Resolver<Input, Output, Context>,
  maybeResolver?: Resolver<Input, Output, Context>
): Method<Input, Output, Context> {
  if (maybeResolver) {
    return {
      type: 'method',
      middleware: combineMiddleware(middlewareOrValidator as MiddlewareLike<Context, Context>),
      validator: validatorOrResolver as Validator<Input>,
      resolver: maybeResolver
    };
  }

  return {
    type: 'method',
    middleware: undefined,
    validator: middlewareOrValidator as Validator<Input>,
    resolver: validatorOrResolver as Resolver<Input, Output, Context>
  };
}

// export const createMethod: MethodCreator = (validator, resolver) => ({ type: 'method', validator, resolver });

export const createService = <T>(createKeys: (method: MethodCreator) => Service<T>['keys']): Service<T> => (
  { type: 'service', keys: createKeys(createMethod) }
);

const httpServer = <
  TService extends Record<string, Method<any, any, any> | Service<any>>,
  RuntimeArgs extends any[]
>(
  options: ServerOptions<TService, RuntimeArgs>
) => {
  const service = { type: 'service', keys: options.service(createMethod) };

  type MethodsClientType<TS> = Readonly<{
    [key in keyof TS]: TS[key] extends Method<any, any, any>
      // `key` is a `Method`, so fake a method
      ? (input: Awaited<ReturnType<TS[key]['validator']>>)
      => Promise<Awaited<ReturnType<TS[key]['resolver']>>>
      : TS[key] extends Service<any>
        // TS[key] is a `Service`, so recurse
        ? MethodsClientType<TS[key]['keys']>
        : TS[key] extends Record<string, any>
          // TS[key] is a key/value, likely just a nested object. Recurse.
          ? MethodsClientType<TS[key]>
          : never
  }>;

  const getMethod = (
    methodPath: string,
    serviceKeys: Service<any>['keys'] | Record<string, Service<any>['keys']> = service.keys
  ): Method<any, any, any> | undefined => {
    const rootOfPath = methodPath.match(/(.*?)\.(.*)/); // [foo].[remaining]
    if (!rootOfPath) { // No more dots in the method path
      if (serviceKeys[methodPath]?.type !== 'method') return undefined;
      return serviceKeys[methodPath] as Method<any, any, any>;
    }

    return getMethod(rootOfPath[2], serviceKeys[rootOfPath[1]].keys || serviceKeys[rootOfPath[1]]);
  };

  return {
    server: async (...args: RuntimeArgs) => options.environment(...args)(
      opts => {
        const next = processMethod({ getMethod, logger: options.logger });
        return next({ ...opts, context: {} });
      }
    ),
    clientStub: {} as MethodsClientType<TService>
  };
};

export default httpServer;

export const noInput = (value: unknown) => (value as void);
