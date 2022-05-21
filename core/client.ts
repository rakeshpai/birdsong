import type { RPCSerializableValue } from './shared';

export const createClient = <T>() => new Proxy({}, {
  get: (target, prop) => (input: RPCSerializableValue) => {
    // eslint-disable-next-line no-console
    console.log('Invoking', prop, input);
    return Promise.resolve(3);
  }
}) as T;
