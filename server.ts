type MaybeAsync<T> = T | Promise<T>;

type RPCSerializableValue =
    | { [property: string]: RPCSerializableValue }
    | readonly RPCSerializableValue[]
    | string
    | number
    | boolean
    | null
    | void;

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

type OpArgs<
  Context,
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> = {
  validator: Validator<Input>;
  resolve: Resolver<Context, Input, Output>;
  contextCreator: () => MaybeAsync<Context>;
};

type ServiceMethodDescrptor<
  Context,
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue
> =
  OpArgs<Context, Input, Output> & { type: 'query' | 'mutation' };

const withContext = <Context>(contextCreator: () => MaybeAsync<Context>) => {
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

// type Methods<Context, T> = {
//   [key in keyof T]: T[key] extends ServiceMethodDescrptor<Context, infer Input, infer Output>
//     ? ServiceMethodDescrptor<Context, Input, Output>
//     : never
// };

type ClientType<T> = {
  [methodName in keyof T]: (
    T[methodName] extends ServiceMethodDescrptor<any, infer Input, infer Output>
      ? (input: Input) => Promise<Output>
      : never
  );
};

type Context = { isLoggedIn: boolean };

const { query } = withContext<Context>(() => ({ isLoggedIn: true }));

const service = {
  getUser: query(
    value => ({ userId: String(value || '') }),
    ({ input, context }) => {
      console.log(input, context.isLoggedIn);
      return ({ name: 'John', surname: 'Doe' });
    }
  ),
  getUserTypes: query(
    () => {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ input, context }): 'a' | 'b' => 'a'
  )
};

// Client

const createClient = <T>() => new Proxy({}, {
  get(target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (...args: any[]) => {
      console.log('Invoking', prop, args);
      return Promise.resolve(3);
    };
  }
}) as T;

type Client = ClientType<typeof service>;

const c = createClient<Client>();
c.getUser({ userId: '1' });
c.getUserTypes();
