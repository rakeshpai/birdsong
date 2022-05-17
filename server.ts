type MaybeAsync<T> = T | Promise<T>;

type RPCSerializableValue =
    | { [property: string]: RPCSerializableValue }
    | readonly RPCSerializableValue[]
    | string
    | number
    | boolean
    | null;

type ResolverArgs<Input extends RPCSerializableValue, Context> = {
  input: Input;
  context: Context;
};

type Validator<Input extends RPCSerializableValue> = (value: unknown) => MaybeAsync<Input>;
type Resolver<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue,
  Context
> = (x: ResolverArgs<Input, Context>) => MaybeAsync<Output>;

type OpArgs<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue,
  Context
> = {
  validator: Validator<Input>;
  resolve: Resolver<Input, Output, Context>;
};

type ServiceMethodDescrptor<
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue,
  Context
> =
  OpArgs<Input, Output, Context> & { type: 'query' | 'mutation' };

const createDescriptor = (type: 'query' | 'mutation') => (
  <Input extends RPCSerializableValue, Output extends RPCSerializableValue, Context>(
    validator: Validator<Input>,
    resolve: Resolver<Input, Output, Context>
  ) => ({
    type, validator, resolve
  })
);

const query = createDescriptor('query');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mutation = createDescriptor('mutation');

const createService = <
  Input extends RPCSerializableValue,
  Output extends RPCSerializableValue,
  Context,
  MethodNames extends string
>(
  createContext: () => Context,
  methods: Record<MethodNames, ServiceMethodDescrptor<Input, Output, Context>>
) => ({
  createContext, methods
});

type Service<Context, SMD, methodName extends string> = {
  createContext: () => Context;
  methods: Record<
    methodName,
    SMD extends ServiceMethodDescrptor<infer Input, infer Output, Context>
      ? ServiceMethodDescrptor<Input, Output, Context>
      : never
  >;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClientType<T extends Service<Context, ServiceMethodDescrptor<any, any, Context>, string>> = {
  [methodName in keyof T['methods']]: (
    T['methods'][methodName] extends ServiceMethodDescrptor<infer Input, infer Output, Context>
      ? (a: Input) => Promise<Output>
      : never
  );
};

type Context = { isLoggedIn: boolean };

const service = createService(() => ({ isLoggedIn: true }), {
  getUser: query(
    value => ({ userId: String(value || '') }),
    ({ input, context }) => {
      console.log(input, context.isLoggedIn);
      return ({ name: 'John', surname: 'Doe' });
    }
  )
});

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
