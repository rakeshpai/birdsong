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

const r1 = service.add(1, 2);
const r2 = service.addDates(new Date(), new Date());
const r3 = service.concat('a', 'b');

Promise.all([r1, r2, r3]).then(x => console.log(x));
