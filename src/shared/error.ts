export type ErrorType =
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

