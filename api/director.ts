import type { IncomingMessage, ServerResponse } from 'node:http';
import { completeDsl, selectedProvider, type DirectorRequest } from '../server/directorCore';

type VercelRequest = IncomingMessage & {
  body?: unknown;
  method?: string;
};

export default async function handler(request: VercelRequest, response: ServerResponse) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = (await readBody(request)) as DirectorRequest;
    const provider = body.provider && body.provider !== 'mock' ? body.provider : selectedProvider();
    sendJson(response, 200, await completeDsl(provider, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(response, 500, { error: message });
  }
}

async function readBody(request: VercelRequest) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') return JSON.parse(request.body);

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}
