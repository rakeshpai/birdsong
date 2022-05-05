import type { MyServiceType } from './server';

const createService = <T>() => new Proxy({}, {
  get(target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (...args: any[]) => {
      console.log('Invoking', prop, args);
      return Promise.resolve(3);
    };
  }
}) as T;

const service = createService<MyServiceType>();

const result = service.add(1, 2);

result.then(x => console.log(x));
