/* eslint-disable no-console */
import { isRPCError } from '../shared/is-error';
import type { LogLine } from './client';

const logger = () => (message: LogLine) => {
  const isError = message.parsed instanceof Error;

  console.groupCollapsed(
    `%cbirdsong%c %casync%c %c${message.methodName}%c(${
      message.input ? '%o' : '%s'
    }) %c⮕%c %c${
      isError ? '%s' : '%o'
    }%c %c(rtt: ${Date.now() - message.startTime}ms)%c`,
    'color: #000; background: #6495ED; padding: 0.1rem 0.2rem; border-radius: 0.3rem',
    '',
    'color: #999',
    '',
    'font-weight: bold;',
    '',
    message.input ?? '',
    'color: #6495ED',
    '',
    isError ? 'background: #f006; padding: 0.1rem 0.2rem; border-radius: 0.3rem' : '',
    isError
      ? `${isRPCError(message.parsed) ? 'RPCError' : 'Error:'} ${
        isRPCError(message.parsed) ? `- ${message.parsed.type}:` : ''
      } ${message.parsed.message}`
      : message.parsed,
    '',
    'color: #fff8; font-style: italic;',
    ''
  );
  console.log('%c     method%c: %c%s%c', 'font-weight: bold;', '', 'font-weight: bold', message.methodName, '');
  console.log('%c  arguments%c: %o', 'font-weight: bold;', '', message.input);
  (isError ? console.error : console.log)('%c     result%c: %o', 'font-weight: bold;', '', message.parsed);
  console.log(
    '%c       http%c: %c%s%c %s %c%s%c',
    'font-weight: bold;',
    '',
    'background: #666; color: #fff; font-weight: bold; padding: 0.1rem 0.3rem; border-radius: 0.3rem',
    message.options.method,
    '',
    message.url,
    `background: ${
      isError ? 'red' : 'green'
    }; color: white; font-weight: bold; padding: 0.1rem 0.3rem; border-radius: 0.3rem`,
    message.response.status,
    ''
  );
  console.groupEnd();
  console.groupEnd();
};

export default logger;
