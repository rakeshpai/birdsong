export const createClient = <T>() => new Proxy({}, {
  get(target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (...args: any[]) => {
      // eslint-disable-next-line no-console
      console.log('Invoking', prop, args);
      return Promise.resolve(3);
    };
  }
}) as T;
