import type { MaybeAsync, RPCSerializableValue } from '../shared/types';

type Validator<Input extends RPCSerializableValue> = (value: unknown) => MaybeAsync<Input>;
type Resolver<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = (x: Input) => MaybeAsync<Output>;

export type ServiceMethodDescriptor<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = {
  validator: Validator<Input>;
  resolver: Resolver<Input, Output>;
};

export const method = <Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
  validator: Validator<Input>,
  resolver: Resolver<Input, Output>
): ServiceMethodDescriptor<Input, Output> => ({ validator, resolver });

export type ClientType<T> = {
  [methodName in keyof T]: T[methodName] extends ServiceMethodDescriptor<infer Input, infer Output>
    ? (input: Input) => Promise<Output>
    : never
};
