import type { RPCSerializableValue } from '../client';
import type { EnvironmentHelpers } from './environments/helpers';

type ContextBase = Record<string, unknown>;

type MiddlewareOptions<Context extends ContextBase> = Omit<EnvironmentHelpers, 'methodDetails'> & {
  methodName: string;
  input: RPCSerializableValue;
  context: Context;
};

export type Middleware<InContext extends ContextBase, OutContext extends ContextBase> = (
  options: MiddlewareOptions<InContext>
) => (next: (context: OutContext) => Promise<void>) => Promise<void>;

export type MiddlewareLike =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Middleware<any, any>
  | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Middleware<any, any>[];

const exists = <T>(x: T | undefined): x is T => !!x;

export const toMiddlewareList = (m: MiddlewareLike) => {
  if (!m) return [];
  return (Array.isArray(m) ? m : [m]).filter(exists);
};

// Adapted from here: https://github.com/selfrefactor/rambda/blob/master/files/index.d.ts#L3070
// Here goes the ugliness

// export function combineMiddleware<
//   R1 extends ContextBase,
//   R2 extends ContextBase,
//   R3 extends ContextBase,
//   R4 extends ContextBase,
//   R5 extends ContextBase,
//   R6 extends ContextBase,
//   R7 extends ContextBase,
//   R8 extends ContextBase>(
//   f1: Middleware<R1, R2>,
//   f2: Middleware<R2, R3>,
//   f3: Middleware<R3, R4>,
//   f4: Middleware<R4, R5>,
//   f5: Middleware<R5, R6>,
//   f6: Middleware<R6, R7>,
//   f7: Middleware<R7, R8>
// ): Middleware<R1, R8>;
// export function combineMiddleware<
//   R1 extends ContextBase,
//   R2 extends ContextBase,
//   R3 extends ContextBase,
//   R4 extends ContextBase,
//   R5 extends ContextBase,
//   R6 extends ContextBase,
//   R7 extends ContextBase
// >(
//   f1: Middleware<R1, R2>,
//   f2: Middleware<R2, R3>,
//   f3: Middleware<R3, R4>,
//   f4: Middleware<R4, R5>,
//   f5: Middleware<R5, R6>,
//   f6: Middleware<R6, R7>
// ): Middleware<R1, R7>;
// export function combineMiddleware<
//   R1 extends ContextBase,
//   R2 extends ContextBase,
//   R3 extends ContextBase,
//   R4 extends ContextBase,
//   R5 extends ContextBase,
//   R6 extends ContextBase
// >(
//   f1: Middleware<R1, R2>,
//   f2: Middleware<R2, R3>,
//   f3: Middleware<R3, R4>,
//   f4: Middleware<R4, R5>,
//   f5: Middleware<R5, R6>
// ): Middleware<R1, R6>;
// export function combineMiddleware<
//   R1 extends ContextBase,
//   R2 extends ContextBase,
//   R3 extends ContextBase,
//   R4 extends ContextBase,
//   R5 extends ContextBase
// >(
//   f1: Middleware<R1, R2>,
//   f2: Middleware<R2, R3>,
//   f3: Middleware<R3, R4>,
//   f4: Middleware<R4, R5>
// ): Middleware<R1, R5>;
// export function combineMiddleware<
//   R1 extends ContextBase,
//   R2 extends ContextBase,
//   R3 extends ContextBase,
//   R4 extends ContextBase
// >(
//   f1: Middleware<R1, R2>,
//   f2: Middleware<R2, R3>,
//   f3: Middleware<R3, R4>
// ): Middleware<R1, R4>;
export function combineMiddleware<
  R1 extends ContextBase,
  R2 extends ContextBase,
  R3 extends ContextBase
>(
  f1: Middleware<R1, R2>,
  f2: Middleware<R2, R3>
): Middleware<R1, R3>;
export function combineMiddleware<
  R1 extends ContextBase,
  R2 extends ContextBase
>(
  f1: Middleware<R1, R2>
): Middleware<R1, R2>;
export function combineMiddleware(...mws: Middleware<any, any>[]): Middleware<any, any> {
  return <T extends ContextBase>(options: MiddlewareOptions<T>) => (
    async <U>(next: (context: U) => Promise<void>) => (
      mws.reduce(
        (prev, mw) => prev.then(() => mw(options)(next)),
        Promise.resolve()
      )
    )
  );
}

// const middleware = combineMiddleware(
//   options => async next => {
//     console.log('middleware 1');
//     await next({ ...options.context, foo: 'bar' });
//     console.log('middleware 1 done');
//   },
//   options => async next => {
//     console.log('middleware 2');
//     await next(options.context);
//     console.log('middleware 2 done');
//   }
// );
