import { decode } from '../shared/type-handlers';
import { isRPCError } from '../shared/is-error';
import { badRequest, noMethodSpecified } from '../shared/error-creators';

const isGettable = (methodName: string) => (
  methodName.startsWith('get')
  || methodName.startsWith('list')
);

const methodDetailsFromUrl = (request: Request) => {
  const url = new URL(request.url);

  const method = url.searchParams.get('method');
  if (!method) { throw noMethodSpecified('Couldn\'t parse method from URL'); }

  const input = url.searchParams.get('input');

  if (isGettable(method)) {
    try {
      const inp = (input ? decode(input) : undefined) as unknown;
      return { method, input: inp };
    } catch (e) {
      throw badRequest(`Couldn't parse input: ${(e as Error).message}`);
    }
  }

  throw noMethodSpecified(`Method ${method} is not allowed as a GET request`);
};

const methodDetailsFromBody = async (request: Request) => {
  const parsedBody = decode(await request.text());
  const { method: bodyMethod, input: bodyInput } = parsedBody || {};

  if (typeof bodyMethod !== 'string') {
    throw noMethodSpecified('Couldn\'t parse method from post body');
  }

  return { method: bodyMethod, input: bodyInput as unknown };
};

export const methodDetails = async (request: Request) => {
  if (request.method.toLowerCase() === 'get') {
    return methodDetailsFromUrl(request);
  }

  return methodDetailsFromBody(request);
};

export const errorResponse = (error: unknown) => {
  if (isRPCError(error)) {
    const {
      statusCode, message, name, type
    } = error;

    return new Response(
      JSON.stringify({ error: { message, name, type: type || 'Unknown' } }),
      { status: statusCode }
    );
  }

  return new Response(
    JSON.stringify({
      error: {
        message: (error instanceof Error ? error.message : 'Unknown'),
        name: (error instanceof Error ? error.name : 'Unknown')
      }
    }),
    { status: 500 }
  );
};
