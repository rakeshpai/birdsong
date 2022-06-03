import type { ErrorType } from './error';
import { RPCError } from './error';

const error = <T extends ErrorType>(type: T, statusCode: number) => (message: string) => (
  new RPCError<T>(type, message, statusCode)
);

export const couldntParseRequest = error('CouldntParseRequest', 400);
export const noMethodSpecified = error('NoMethodSpecified', 400);
export const methodNotAllowed = error('MethodNotAllowed', 400);
export const methodNotFound = error('MethodNotFound', 400);
export const internalServerError = error('InternalServerError', 500);
export const badRequest = error('BadRequest', 400);
export const unauthorized = error('Unauthorized', 401);
export const forbidden = error('Forbidden', 403);
export const notFound = error('NotFound', 404);
