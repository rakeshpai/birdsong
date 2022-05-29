export type RPCSerializableValue =
  | { [property: string | number]: RPCSerializableValue }
  | readonly RPCSerializableValue[]
  | Date
  | RegExp
  | Map<string | number | boolean, RPCSerializableValue>
  | Set<RPCSerializableValue>
  | string
  | number
  | boolean
  | null
  | void;

export type MaybeAsync<T> = T | Promise<T>;

export type Validator<Input extends RPCSerializableValue> = (value: unknown) => MaybeAsync<Input>;
