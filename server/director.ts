import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { completeDsl, providerStatus, selectedProvider, type DirectorRequest } from './directorCore';

const port = Number(process.env.PHOSPHOR_API_PORT || 8787);
loadDotEnv();

const server = createServer(async (request, response) => {
  applyCors(response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (request.method === 'GET' && request.url === '/api/providers') {
      sendJson(response, 200, providerStatus());
      return;
    }

    if (request.method === 'POST' && request.url === '/api/director') {
      const body = (await readJson(request)) as DirectorRequest;
      const provider = body.provider && body.provider !== 'mock' ? body.provider : selectedProvider();
      sendJson(response, 200, await completeDsl(provider, body));
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Phosphor director API listening on http://127.0.0.1:${port}`);
});

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function applyCors(response: ServerResponse) {
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function loadDotEnv() {
  const path = resolve(process.cwd(), '.env');
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
