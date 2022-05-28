export type RPCSerializableValue =
  | { [property: string]: RPCSerializableValue }
  | readonly RPCSerializableValue[]
  | Date
  | RegExp
  | string
  | number
  | boolean
  | null
  | void;

export type MaybeAsync<T> = T | Promise<T>;

export type Validator<Input extends RPCSerializableValue> = (value: unknown) => MaybeAsync<Input>;

