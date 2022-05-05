const add = (a: number, b: number) => Promise.resolve({ a, b });
const concat = (a: string, b: string) => a + b;
const addDates = (x: Date, y: Date) => x.getTime() + y.getTime();

type RPCSerializableValue =
    | string
    | number
    | boolean
    | { [x: string]: RPCSerializableValue }
    | RPCSerializableValue[];

type RPCFunction = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (...args: any[]): RPCSerializableValue | Promise<RPCSerializableValue>;
};

type RPCService<T extends Record<string, RPCFunction>> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly [P in keyof T]: T[P] extends (...args: any[]) => Promise<infer U>
    ? Parameters<T[P]> extends RPCSerializableValue[]
      ? (...args: Parameters<T[P]>) => Promise<U>
      : never
    : Parameters<T[P]> extends RPCSerializableValue[]
      ? (...args: Parameters<T[P]>) => Promise<ReturnType<T[P]>>
      : never
};

const toExpose = { add, concat, addDates };

export type MyServiceType = RPCService<typeof toExpose>;
