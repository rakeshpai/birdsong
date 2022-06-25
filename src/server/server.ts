import type {
  MethodCreator, ServerOptions, Service, Method
} from './types';
import processMethod from './process-method';

export const method: MethodCreator = (validator, resolver) => ({ type: 'method', validator, resolver });

const httpServer = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TService extends Record<string, Method<any, any, any> | Service<any>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RuntimeArgs extends any[]
>(
  options: ServerOptions<TService, RuntimeArgs>
) => {
  const keys = options.service(method);
  const service = {
    type: 'service',
    keys
  } as Service<typeof keys>;

  type MethodsClientType<TS> = Readonly<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key in keyof TS]: TS[key] extends Method<any, any, any>
      ? (input: Awaited<ReturnType<TS[key]['validator']>>)
      => Promise<Awaited<ReturnType<TS[key]['resolver']>>>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : TS[key] extends Service<any>
        ? MethodsClientType<TS[key]['keys']>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : TS[key] extends Record<string, any>
          ? MethodsClientType<TS[key]>
          : never
  }>;

  const getMethod = (
    methodPath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serviceKeys: Service<any>['keys'] | Record<string, Service<any>['keys']> = service.keys
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Method<any, any, any> | undefined => {
    const rootOfPath = methodPath.match(/(.*?)\.(.*)/);
    if (!rootOfPath) { // No more dots in the method path
      if (serviceKeys[methodPath]?.type === 'method') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return serviceKeys[methodPath] as Method<any, any, any>;
      }
      return undefined;
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
