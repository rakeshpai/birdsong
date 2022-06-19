/// <reference types="node" />
import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';
// eslint-disable-next-line @typescript-eslint/no-redeclare
import { ReadableStream } from 'node:stream/web';
import cookie from 'cookie';
import type { RequestHandler } from '../types';

// Adapted from https://github.com/cloudflare/miniflare/blob/master/packages/http-server

export const headersFromIncomingRequest = (req: IncomingMessage): Headers => {
  const headers = new Headers();

  Object.entries(req.headers).forEach(([name, values]) => {
    if (Array.isArray(values)) {
      values.forEach(value => headers.append(name, value));
    } else if (values !== undefined) {
      headers.append(name, values);
    }
  });

  return headers;
};

const convertNodeRequest = async (req: IncomingMessage) => {
  // @ts-expect-error encrypted is only defined in tls.TLSSocket
  const protocol = req.socket.encrypted ? 'https' : 'http';
  const origin = `${protocol}://${req.headers.host ?? 'localhost'}`;
  const url = new URL(req.url ?? '', origin);

  let body: BodyInit | null = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let iterator: AsyncIterableIterator<any>;
    body = new ReadableStream({
      type: 'bytes',
      start() {
        iterator = req[Symbol.asyncIterator]();
      },
      async pull(controller) {
        const { done, value } = await iterator.next();
        if (done) {
          queueMicrotask(() => {
            controller.close();
            // Not documented in MDN but if there's an ongoing request that's waiting,
            // we need to tell it that there were 0 bytes delivered so that it unblocks
            // and notices the end of stream.
            // @ts-expect-error `byobRequest` has type `undefined` in `@types/node`
            controller.byobRequest?.respond(0);
          });
        } else {
          const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
          controller.enqueue(new Uint8Array(buffer));
        }
      },
      async cancel() {
        await iterator.return?.();
      }
    });
  }

  req.headers.host = url.host;

  // Build Headers object from request
  const headers = headersFromIncomingRequest(req);

  return new Request(url.toString(), {
    method: req.method,
    headers,
    body,
    redirect: 'manual'
  });
};

const writeResponse = (response: Response, res: ServerResponse): Promise<void> => new Promise(resolve => {
  const headers: OutgoingHttpHeaders = {};
  response.headers.forEach(([name, value]) => {
    headers[name.toLowerCase()] = value;
  });

  res.writeHead(response.status, headers);

  if (response.body) {
    response.body.pipeTo(new WritableStream({
      write(chunk) { res.write(chunk); },
      close() { res.end(resolve); },
      abort() { res.end(resolve); }
    }));
  } else {
    resolve();
  }
});

export default (nodeRequest: IncomingMessage, nodeResponse: ServerResponse): RequestHandler => (
  async next => {
    const cookieJar: string[] = [];
    const cookies = cookie.parse(nodeRequest.headers.cookie || '');

    const request = await convertNodeRequest(nodeRequest);
    const setCookie = (name: string, value: string, options: cookie.CookieSerializeOptions | undefined): void => {
      cookieJar.push(cookie.serialize(name, value, options));
    };
    const response = await next({
      request,
      cookies,
      setCookie,
      deleteCookie: (name: string, options: cookie.CookieSerializeOptions | undefined) => {
        setCookie(name, '', { ...options, maxAge: 0 });
      }
    });

    cookieJar.forEach(cookie => nodeResponse.setHeader('Set-Cookie', cookie));

    return writeResponse(response, nodeResponse);
  }
);
