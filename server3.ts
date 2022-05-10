type MaybeAsync<T> = T | Promise<T>;

type ResolverArgs<Input, Context> = {
  input: Input;
  context: Context;
};

type OpArgs<Input, Output, Context> = {
  input: (value: unknown) => Input;
  resolve: ({ input, context }: ResolverArgs<Input, Context>) => MaybeAsync<Output>;
};

type ServiceMethodDescrptor<Input, Output, Context> =
  OpArgs<Input, Output, Context>
  & { type: 'query' | 'mutation' };

const createDescriptor = (type: 'query' | 'mutation') => (
  <Input, Output, Context>(
    { input, resolve }: OpArgs<Input, Output, Context>
  ): ServiceMethodDescrptor<Input, Output, Context> => ({
    type, input, resolve
  })
);

const query = createDescriptor('query');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mutation = createDescriptor('mutation');

const createService = <Input, Output, Context, MethodNames extends string>(
  createContext: () => Context,
  methods: Record<MethodNames, ServiceMethodDescrptor<Input, Output, Context>>
) => ({
  createContext, methods
});

type Service<Context, T extends ServiceMethodDescrptor<any, any, Context>, methodName extends string> = {
  createContext: () => Context;
  methods: Record<
    methodName,
    T extends ServiceMethodDescrptor<infer Input, infer Output, Context>
      ? ServiceMethodDescrptor<Input, Output, Context>
      : never
  >;
};

type ClientType<T extends Service<Context, ServiceMethodDescrptor<any, any, any>, string>> = {
  [methodName in keyof T['methods']]: (
    T['methods'][methodName] extends ServiceMethodDescrptor<infer Input, infer Output, Context>
      ? (a: Input) => Promise<Output>
      : never
  );
};

type Context = { isLoggedIn: boolean };

const service = createService(() => ({ isLoggedIn: true }), {
  getUser: query({
    input: value => ({ userId: String(value || '') }),
    resolve: ({ input, context }) => {
      console.log(input, context.isLoggedIn);
      return ({ name: 'John', surname: 'Doe' });
    }
  })
});

// Client

const createClient = <T extends ClientType<any>>() => new Proxy({}, {
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
c.getUser();
