/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'http';
import cookie from 'cookie';
import { parse as urlParse } from 'url';
import type { EnvironmentHelpers } from './helpers';
import type { RPCError } from '../../shared/error';

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

  const clearCookie = (name: string) => {
    response.setHeader('Set-Cookie', cookie.serialize(name, '', { expires: new Date(0) }));
  };

  const sendResponse = (output: unknown) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(output);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendError = (error: RPCError<any>) => {
    response.writeHead(error.statusCode || 500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      error: {
        message: error.message,
        type: error.type || 'Unknown'
      }
    }));
  };

  const setHeader = (name: string, value: string) => {
    response.setHeader(name, value);
  };

  const getHeader = (name: string): string | undefined => request.headers[name] as string | undefined;

  return {
    httpMethod: request.method,
    methodDetailsIfGet: () => ({
      name: searchParams.method as string | undefined,
      input: searchParams.input as string | undefined
    }),
    postBody,
    setCookie,
    readCookie,
    clearCookie,
    setHeader,
    getHeader,
    sendResponse,
    sendError
  };
};

export default nodejs;
