import type { ErrorType } from './error';
import { RPCError } from './error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isRPCError = (e: unknown): e is RPCError<any> => e instanceof RPCError;

const isOfType = <T extends ErrorType>(type: T) => (error: unknown): error is RPCError<T> => (
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
