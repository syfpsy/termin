import type { ServerResponse } from 'node:http';
import { providerStatus } from '../server/directorCore';

export default function handler(_request: unknown, response: ServerResponse) {
  response.setHeader('Content-Type', 'application/json');
  response.statusCode = 200;
  response.end(JSON.stringify(providerStatus()));
}
