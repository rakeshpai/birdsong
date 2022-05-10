const add = (a: number, b: number) => Promise.resolve({ a, b });
const concat = (a: string, b: string) => a + b;
const addDates = (x: Date, y: Date) => x.getTime() + y.getTime();

type RPCSerializableValue =
    | { [property: string]: RPCSerializableValue }
    | readonly RPCSerializableValue[]
    | string
    | number
    | boolean
    | null;

type Promisify<T> = T extends Promise<infer U> ? Promise<U> : Promise<T>;

type RPCFunction = (...args: RPCSerializableValue[]) => RPCSerializableValue | Promise<RPCSerializableValue>;

type RPCService<T extends Record<string, RPCFunction>> = {
  readonly [P in keyof T]: T[P] extends (...args: RPCSerializableValue[]) => Promise<infer U>
    ? Parameters<T[P]> extends RPCSerializableValue[]
      ? (...args: Parameters<T[P]>) => Promisify<U>
      : never
    : Parameters<T[P]> extends RPCSerializableValue[]
      ? (...args: Parameters<T[P]>) => Promisify<ReturnType<T[P]>>
      : never
};

const toExpose = { add, concat, addDates };

export type MyServiceType = RPCService<typeof toExpose>;
