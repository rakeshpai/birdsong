import type { RPCSerializableValue } from '../client';
import type { EnvironmentHelpers } from './environments/helpers';

type MiddlewareOptions<InContext, OutContext> = Omit<EnvironmentHelpers, 'methodDetails'> & {
  methodName: string;
  input: RPCSerializableValue;
  context: InContext;
  next: (context: OutContext) => Promise<void>;
};

export type Middleware<InContext, OutContext> = (
  options: MiddlewareOptions<InContext, OutContext>
) => Promise<void>;

export type MiddlewareLike =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Middleware<any, any>
  | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | (Middleware<any, any> | undefined)[];

const exists = <T>(x: T | undefined): x is T => !!x;

export const toMiddlewareList = (m: MiddlewareLike) => {
  if (!m) return [];
  return (Array.isArray(m) ? m : [m]).filter(exists);
};

// Adapted from here: https://github.com/selfrefactor/rambda/blob/master/files/index.d.ts#L3070
// Here goes the ugliness

export function combineMiddleware<R1, R2, R3, R4, R5, R6, R7, R8>(
  f1: Middleware<R1, R2>,
  f2: Middleware<R2, R3>,
  f3: Middleware<R3, R4>,
  f4: Middleware<R4, R5>,
  f5: Middleware<R5, R6>,
  f6: Middleware<R6, R7>,
  f7: Middleware<R7, R8>
): Middleware<R1, R8>;
export function combineMiddleware<R1, R2, R3, R4, R5, R6, R7>(
  f1: Middleware<R1, R2>,
  f2: Middleware<R2, R3>,
  f3: Middleware<R3, R4>,
  f4: Middleware<R4, R5>,
  f5: Middleware<R5, R6>,
  f6: Middleware<R6, R7>
): Middleware<R1, R7>;
export function combineMiddleware<R1, R2, R3, R4, R5, R6>(
  f1: Middleware<R1, R2>,
  f2: Middleware<R2, R3>,
  f3: Middleware<R3, R4>,
  f4: Middleware<R4, R5>,
  f5: Middleware<R5, R6>
): Middleware<R1, R6>;
export function combineMiddleware<R1, R2, R3, R4, R5>(
  f1: Middleware<R1, R2>,
  f2: Middleware<R2, R3>,
  f3: Middleware<R3, R4>,
  f4: Middleware<R4, R5>
): Middleware<R1, R5>;
export function combineMiddleware<R1, R2, R3, R4>(
  f1: Middleware<R1, R2>,
  f2: Middleware<R2, R3>,
  f3: Middleware<R3, R4>
): Middleware<R1, R4>;
export function combineMiddleware<R1, R2, R3>(
  f1: Middleware<R1, R2>,
  f2: Middleware<R2, R3>
): Middleware<R1, R3>;
export function combineMiddleware<R1, R2>(
  f1: Middleware<R1, R2>
): Middleware<R1, R2>;
export function combineMiddleware(...mws: Middleware<any, any>[]) {
  return (options: MiddlewareOptions<any, any>) => {
    mws.reduce((acc, mw) => acc.then(() => mw(options)), Promise.resolve());
  };
}
