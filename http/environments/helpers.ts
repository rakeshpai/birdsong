import { noMethodSpecified } from '../errors';
import type { EnvironmentHelpers } from '../types';

const isGettable = (methodName: string) => (
  methodName.startsWith('get')
  || methodName.startsWith('list')
);

export const getMethodDetails = async (
  requestMethod: string,
  url: { method: string | null; input: string | null },
  postBody: () => Promise<{ method: string | null; input: string | null }>
): ReturnType<EnvironmentHelpers['methodDetails']> => {
  if (requestMethod.toLowerCase() === 'get') {
    if (url.method === null) throw noMethodSpecified('Couldn\'t parse method from URL');

    if (isGettable(url.method)) {
      return { name: url.method, input: url.input };
    }

    throw noMethodSpecified(`Method ${url.method} is not allowed as a GET request`);
  }

  const { method, input } = await postBody();

  if (method === null) throw noMethodSpecified('Couldn\'t parse method from post body');
  return { name: method, input };
};
