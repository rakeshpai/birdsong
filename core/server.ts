import type { MaybeAsync, RPCSerializableValue } from './shared';

type ResolverArgs<Context, Input extends RPCSerializableValue> = {
  input: Input;
  context: Context;
};

type Validator<Input extends RPCSerializableValue> = (value: unknown) => MaybeAsync<Input>;
type Resolver<
  Context,
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = (x: ResolverArgs<Context, Input>) => MaybeAsync<Output>;

type ContextCreator<Context> = () => MaybeAsync<Context>;

type ServiceMethodDescrptor<
  Context,
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = {
  type: 'query' | 'mutation';
  validator: Validator<Input>;
  resolve: Resolver<Context, Input, Output>;
  contextCreator: ContextCreator<Context>;
};

export const withContext = <Context>(contextCreator: ContextCreator<Context>) => {
  const createDescriptor = (type: 'query' | 'mutation') => (
    <Input extends RPCSerializableValue, Output extends RPCSerializableValue>(
      validator: Validator<Input>,
      resolve: Resolver<Context, Input, Output>
    ): ServiceMethodDescrptor<Context, Input, Output> => ({
      type, validator, resolve, contextCreator
    })
  );

  const query = createDescriptor('query');
  const mutation = createDescriptor('mutation');

  return { query, mutation };
};

export type ClientType<T> = {
  [methodName in keyof T]: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    T[methodName] extends ServiceMethodDescrptor<any, infer Input, infer Output>
      ? (input: Input) => Promise<Output>
      : never
  );
};
