import { internalServerError, methodNotFound } from '../shared/error-creators';
import { encode } from '../shared/type-handlers';
import type { MaybeAsync } from '../shared/types';
import { isRPCError } from '../shared/is-error';
import { errorResponse, methodDetails } from './helpers';
import type {
  ContextBase, LogLine, NextOptions, ServiceMethodDescriptor
} from './types';

const asyncTryCatch = async <T>(fn: () => MaybeAsync<T>, c?: (e: unknown) => MaybeAsync<T>): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    if (c) { return c(e); }
    throw e;
  }
};

const processMethod = ({ getMethod, logger }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMethod: (n: string) => ServiceMethodDescriptor<any, any, any> | undefined;
  logger?: (log: LogLine) => void;
}) => (
  async <Context extends ContextBase>({ request, ...rest }: NextOptions<Context>) => asyncTryCatch(async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const log = logger || (() => {});

    const { method: methodName, input } = await asyncTryCatch(
      () => methodDetails(request),
      e => {
        log({ type: 'error-parse-method-details', error: e });
        throw e;
      }
    );

    const method = getMethod(methodName);

    if (!method) {
      log({ type: 'error-method-not-found', methodName, input });
      throw methodNotFound(`Method not found: ${method}`);
    }

    log({ type: 'method-description', methodName, input });

    const validatedInput = await asyncTryCatch(
      () => method.validator(input),
      e => {
        log({ type: 'error-validate-input', input, error: e });
        throw e;
      }
    );

    // eslint-disable-next-line object-curly-newline
    log({ type: 'validation-passed', methodName, input, validatedInput });

    const output = await asyncTryCatch(
      () => method.resolver(validatedInput, { request, ...rest }),
      e => {
        if (isRPCError(e)) {
          // eslint-disable-next-line object-curly-newline
          log({ type: 'error-resolve-method-rpc', input, validatedInput, error: e });
          throw e;
        }
        // eslint-disable-next-line object-curly-newline
        log({ type: 'error-resolve-method-unknown', input, validatedInput, error: e });
        throw internalServerError('Internal server error');
      }
    );

    // eslint-disable-next-line object-curly-newline
    log({ type: 'method-output', input, validatedInput, output });

    return new Response(encode(output), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }, errorResponse)
);

export default processMethod;
