import type { NextOptions } from './types';

export type MiddlewareOptions<
  InContext,
  OutContext
> = NextOptions<InContext> & {
  next: (ctx: OutContext) => Promise<Response>;
};

export type Middleware<
  InContext,
  OutContext
> = (options: MiddlewareOptions<InContext, OutContext>) => Promise<Response>;

const combineTwoMiddlewares = <
  InContext,
  OutContext,
  Intermediate = InContext
>(
  m1: Middleware<InContext, Intermediate>,
  m2: Middleware<Intermediate, OutContext>
): Middleware<InContext, OutContext> => (
  options => (
    m1({
      ...options,
      next: context => m2({ ...options, context, next: options.next })
    })
  )
);

export const noOpMiddleware = <Context>(
  options: MiddlewareOptions<Context, Context>
) => options.next(options.context);

export type MiddlewareLike<
  InContext,
  OutContext,
  IntermediateContext1 = InContext,
  IntermediateContext2 = IntermediateContext1
> =
  | Middleware<InContext, OutContext>
  | undefined
  | [
    Middleware<InContext, IntermediateContext1>,
    Middleware<IntermediateContext1, OutContext>
  ]
  | [
    Middleware<InContext, IntermediateContext1>,
    Middleware<IntermediateContext1, IntermediateContext2>,
    Middleware<IntermediateContext2, OutContext>
  ];

const exists = <T>(x: T | undefined): x is T => !!x;

const toCleanList = <T>(thing: T | undefined | T[]) => {
  if (!thing) return [];
  return (Array.isArray(thing) ? thing : [thing]).filter(exists);
};

export const combineMiddleware = <
  InContext,
  OutContext
>(m: MiddlewareLike<InContext, OutContext>): Middleware<InContext, OutContext> => {
  const mws = toCleanList(m);
  if (mws.length === 1) return mws[0] as Middleware<InContext, OutContext>;

  return mws.reduce<Middleware<InContext, OutContext>>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (acc, mw) => combineTwoMiddlewares<any, any>(acc, mw),
    // eslint-disable-next-line @typescript-eslint/prefer-reduce-type-parameter, @typescript-eslint/no-explicit-any
    noOpMiddleware as Middleware<any, any>
  );
};
