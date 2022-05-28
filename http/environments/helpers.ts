import { decode } from '../type-handlers';
import { noMethodSpecified } from '../errors';
import type { EnvironmentHelpers } from '../types';

const isGettable = (methodName: string) => (
  methodName.startsWith('get')
  || methodName.startsWith('list')
);

export const getMethodDetails = async (
  requestMethod: string,
  methodDetails: { name: string | null; input: string | null },
  postBody: () => Promise<string>
): ReturnType<EnvironmentHelpers['methodDetails']> => {
  if (requestMethod.toLowerCase() === 'get') {
    if (methodDetails.name === null) throw noMethodSpecified('Couldn\'t parse method from URL');

    if (isGettable(methodDetails.name)) {
      return { name: methodDetails.name, input: methodDetails.input ? decode(methodDetails.input) : null };
    }

    throw noMethodSpecified(`Method ${methodDetails.name} is not allowed as a GET request`);
  }

  const { method, input } = decode(await postBody());

  if (method === null) throw noMethodSpecified('Couldn\'t parse method from post body');
  return { name: method, input };
};
