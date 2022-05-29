/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'http';
import cookie from 'cookie';
import { parse as urlParse } from 'url';
import type { EnvironmentHelpers } from './types';
import { getMethodDetails } from './helpers';
import type { RPCError } from '../../shared/errors';

const nodejs = (request: IncomingMessage, response: ServerResponse): EnvironmentHelpers => {
  const cookies = cookie.parse(request.headers.cookie || '');
  const searchParams = urlParse(request.url || '', true).query;

  const postBody = (() => {
    const result: Promise<string> = new Promise((resolve, reject) => {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => resolve(body));
      request.on('error', reject);
    });

    return () => result;
  })();

  const setCookie = (name: string, value: string) => {
    response.setHeader('Set-Cookie', cookie.serialize(name, value));
  };

  const readCookie = (name: string): string | undefined => cookies[name];

  const sendResponse = (output: unknown) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(output);
  };

  const sendError = (error: RPCError<any>) => {
    response.writeHead(error.statusCode || 500, { 'Content-Type': 'application/json' });
    response.end({
      error: {
        message: error.message,
        type: error.type || 'Unknown'
      }
    });
  };

  const methodDetails = () => getMethodDetails(
    request.method || 'GET',
    {
      name: searchParams.method as string | null,
      input: searchParams.input as string | null
    },
    postBody
  );

  return {
    setCookie, readCookie, sendResponse, sendError, methodDetails
  };
};

export default nodejs;
