type QueryDescriptor<Input, Output, Context> = Readonly<{
  name: string;
  input: (value: unknown) => Input;
  resolve: ({ input, context }: { input: Input; context: Context }) => Output | Promise<Output>;
}>;

type ServiceCreator<Context> = () => {
  query: <Input, Output>(descriptor: QueryDescriptor<Input, Output, Context>) => ServiceCreator<Context>;
  mutation: <Input, Output>(descriptor: QueryDescriptor<Input, Output, Context>) => ServiceCreator<Context>;
};

type ContextOld = {
  isLoggedIn: boolean;
};

const createServiceOld: ServiceCreator<ContextOld> = () => {
  const service = {
    query: <Input, Output>(descriptor: QueryDescriptor<Input, Output, ContextOld>) => service,
    mutation: <Input, Output>(descriptor: QueryDescriptor<Input, Output, ContextOld>) => service
  };

  return service;
};

const serviceOld = createService()
  .query({
    name: 'getUser',
    input: value => ({ userId: String(value) }),
    resolve: ({ input, context }) => {
      console.log(input, context.isLoggedIn);
      return ({ name: 'John', surname: 'Doe' });
    }
  });
