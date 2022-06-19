import { internalServerError, methodNotFound } from '../shared/error-creators';
import { encode } from '../shared/type-handlers';
import type { MaybeAsync } from '../shared/types';
import { isRPCError } from '../shared/is-error';
import { errorResponse, methodDetails } from './helpers';
import type {
  ContextBase, LogLine, NextOptionsBase, ServiceMethodDescriptor
} from './types';

const asyncTryCatch = async <T>(fn: () => MaybeAsync<T>, c?: (e: unknown) => MaybeAsync<T>): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    if (c) { return c(e); }
    throw e;
  }
};

const processMethod = <Context extends ContextBase>({ getMethod, logger }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMethod: (n: string) => ServiceMethodDescriptor<any, any, Context> | undefined;
  logger?: (log: LogLine) => void;
}) => (
  async ({ request, ...rest }: NextOptionsBase) => asyncTryCatch(async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const log = logger || (() => {});

    const md = await asyncTryCatch(
      () => methodDetails(request),
      e => {
        log({ type: 'error-parse-method-details', error: e });
        throw e;
      }
    );

    const method = getMethod(md.method);

    if (!method) {
      log({ type: 'error-method-not-found', methodName: md.method, input: md.input });
      throw methodNotFound(`Method not found: ${md.method}`);
    }

    log({ type: 'method-description', methodName: md.method, input: md.input });

    const validatedInput = await asyncTryCatch(
      () => method.validator(md.input),
      e => {
        log({ type: 'error-validate-input', input: md.input, error: e });
        throw e;
      }
    );

    log({
      type: 'validation-passed', methodName: md.method, input: md.input, validatedInput
    });

    const output = await asyncTryCatch(
      () => method.resolver(validatedInput, { request, ...rest, context: {} as any }),
      e => {
        if (isRPCError(e)) {
          log({
            type: 'error-resolve-method-rpc', input: md.input, validatedInput, error: e
          });
          throw e;
        }
        log({
          type: 'error-resolve-method-unknown', input: md.input, validatedInput, error: e
        });
        throw internalServerError('Internal server error');
      }
    );

    log({
      type: 'method-output', input: md.input, validatedInput, output
    });

    return new Response(encode(output), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }, errorResponse)
);

export default processMethod;
