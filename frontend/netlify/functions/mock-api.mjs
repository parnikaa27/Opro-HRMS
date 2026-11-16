// The Netlify demo's API: the dev mock, answering every /api request with made up people.
// Netlify hands over a web Request; the mock speaks Node's req and res, so this translates between them.
// The mock's data lives in memory, so changes last only until Netlify starts a fresh copy.
import { Readable } from 'node:stream';

process.env.MOCK_STATELESS_SESSIONS = 'true';
const { handle } = await import('../../dev-server/server.mjs');

export const config = { path: '/api/*' };

export default async (request) => {
  const url = new URL(request.url);
  const body = Buffer.from(await request.arrayBuffer());
  const req = Object.assign(Readable.from(body.length > 0 ? [body] : []), {
    method: request.method,
    url: url.pathname + url.search,
    headers: Object.fromEntries(request.headers),
  });

  let status = 200;
  const headers = new Headers();
  const chunks = [];
  const res = {
    writeHead: (code, values = {}) => {
      status = code;
      Object.entries(values).forEach(([name, value]) => headers.set(name, String(value)));
    },
    appendHeader: (name, value) => headers.append(name, value),
    end: (chunk) => {
      if (chunk !== undefined) {
        chunks.push(Buffer.from(chunk));
      }
    },
  };
  await handle(req, res);
  return new Response(chunks.length > 0 ? Buffer.concat(chunks) : null, { status, headers });
};
