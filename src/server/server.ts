import type {
  Method, ServerOptions, Service, ServiceMethodDescriptor
} from './types';
import processMethod from './process-method';

export const method: Method = (validator, resolver) => ({ validator, resolver });

const httpServer = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TService extends Record<string, ServiceMethodDescriptor<any, any, any> | Service<any>>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RuntimeArgs extends any[]
>(
  options: ServerOptions<TService, RuntimeArgs>
) => {
  const methods = options.service(method);

  type MethodsClientType<TS> = Readonly<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key in keyof TS]: TS[key] extends ServiceMethodDescriptor<any, any, any>
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
    return current as unknown as ServiceMethodDescriptor<any, any, any>;
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
