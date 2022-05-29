type ErrorType =
  | 'CouldntParseRequest'
  | 'NoMethodSpecified'
  | 'MethodNotAllowed'
  | 'MethodNotFound'
  | 'InternalServerError'
  | 'BadRequest'
  | 'Unauthorized'
  | 'Forbidden'
  | 'NotFound';

export class RPCError<T extends ErrorType> extends Error {
  type: T;

  statusCode: number;

  constructor(type: T, message: string, statusCode: number) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
  }
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isRPCError = (e: unknown): e is RPCError<any> => e instanceof RPCError;

const isOfType = (type: ErrorType) => (error: unknown): error is RPCError<typeof type> => (
  isRPCError(error) && error.type === type
);

export const isCouldntParseRequest = isOfType('CouldntParseRequest');
export const isNoMethodSpecified = isOfType('NoMethodSpecified');
export const isMethodNotAllowed = isOfType('MethodNotAllowed');
export const isMethodNotFound = isOfType('MethodNotFound');
export const isInternalServerError = isOfType('InternalServerError');
export const isBadRequest = isOfType('BadRequest');
export const isUnauthorized = isOfType('Unauthorized');
export const isForbidden = isOfType('Forbidden');
export const isNotFound = isOfType('NotFound');
