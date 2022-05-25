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

export class RPCError extends Error {
  type: ErrorType;

  statusCode: number;

  constructor(type: ErrorType, message: string, statusCode: number) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
  }
}

const error = (type: ErrorType, statusCode: number) => (message: string) => (
  new RPCError(type, message, statusCode)
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

const isOfType = (type: ErrorType) => (error: RPCError) => (
  error instanceof RPCError && error.type === type
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
