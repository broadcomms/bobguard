/**
 * Minimal node:https-based HTTP client.
 *
 * Why not the global fetch (undici)?
 * Some IBM Cloud gateways (notably the OpenScale instance API used by
 * watsonx.governance) return HTTP 500 to undici-shaped requests but
 * accept node:https requests with the same URL + token. Suspected to be
 * a header / TLS-negotiation quirk. Using node:https avoids the issue.
 *
 * Returned promise rejects on transport errors; non-2xx responses still
 * resolve so the caller can inspect `status` and decide whether to fall back.
 */

import { request as httpsRequest, RequestOptions } from 'https';
import { URL } from 'url';

export interface HttpResponse {
  status: number;
  body: string;
}

export interface HttpRequestOptions {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

export function httpJsonRequest(opts: HttpRequestOptions): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(opts.url);
    const reqOpts: RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: opts.method,
      headers: opts.headers,
    };
    const req = httpsRequest(reqOpts, (res) => {
      let body = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
