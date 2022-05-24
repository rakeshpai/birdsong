import type { IncomingMessage, ServerResponse } from 'http';
import cookie from 'cookie';
import { URL, URLSearchParams } from 'url';
import type { EnvironmentHelpers } from '../types';
import { getMethodDetails } from './helpers';

const nodejs = (request: IncomingMessage, response: ServerResponse): EnvironmentHelpers => {
  const cookies = cookie.parse(request.headers.cookie || '');
  const { searchParams } = new URL(request.url || '');

  const postBody = (() => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    const result = new Promise(resolve => { request.on('end', () => { resolve(body); }); });
    return async () => {
      const body = await (result as Promise<string>);
      const parsed = new URLSearchParams(body);
      return { method: parsed.get('method'), input: parsed.get('input') };
    };
  })();

  const setCookie = (name: string, value: string) => {
    response.setHeader('Set-Cookie', cookie.serialize(name, value));
  };

  const readCookie = (name: string): string | undefined => cookies[name];

  const sendResponse = (output: unknown) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(output));
  };

  const sendError = (error: Error, errorCode: number) => {
    response.writeHead(errorCode, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: error.message }));
  };

  const methodDetails = () => getMethodDetails(
    request.method || 'GET',
    { method: searchParams.get('method'), input: searchParams.get('input') },
    postBody,
    sendError
  );

  return {
    setCookie, readCookie, sendResponse, sendError, methodDetails
  };
};

export default nodejs;
