import type { EnvironmentHelpers } from '../types';

const isGettable = (methodName: string) => (
  methodName.startsWith('get')
  || methodName.startsWith('list')
);

export const getMethodDetails = async (
  requestMethod: string,
  url: { method: string | null; input: string | null },
  postBody: () => Promise<{ method: string | null; input: string | null }>,
  sendError: (error: Error, errorCode: number) => void
): ReturnType<EnvironmentHelpers['methodDetails']> => {
  if (requestMethod.toLowerCase() === 'get') {
    if (url.method === null) {
      sendError(new Error('No method specified'), 400);
    }

    if (url.method === null) return sendError(new Error('No method specified'), 400);

    if (isGettable(url.method)) {
      return { name: url.method, input: url.input };
    }
    return sendError(new Error(`Method not allowed: ${url.method} can't be requested as a GET`), 405);
  }

  const { method, input } = await postBody();

  if (method === null) return sendError(new Error('No method specified'), 400);
  return { name: method, input };
};
