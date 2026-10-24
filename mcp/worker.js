// Remote MCP server for the Between team (deployed as its own Worker, `between-mcp`).
// Stateless Streamable HTTP at /mcp. Sits behind its own Cloudflare Access application; every
// request's signed Access token is verified here (never the plain email header), and the person's
// role decides which tools they get (mcp/tools.js). Shares OPS_DB with the site.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { verifyAccessJwt } from '../src/lib/access-jwt.js';
import { registerTools } from './tools.js';

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

async function signedInEmail(request, env) {
  // Local dev has no Access in front; LOCAL_DEV_SKIP_ACCESS_CHECK lives only in the git-ignored .dev.vars.
  if (env.LOCAL_DEV_SKIP_ACCESS_CHECK === '1') {
    return (request.headers.get('Cf-Access-Authenticated-User-Email') || '').toLowerCase() || null;
  }
  const verified = await verifyAccessJwt(request, env.ACCESS_AUD);
  const claimed = (request.headers.get('Cf-Access-Authenticated-User-Email') || '').toLowerCase();
  return verified && (!claimed || claimed === verified) ? verified : null;
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') return json({ ok: true });
    if (pathname !== '/mcp') return json({ error: 'Not found' }, 404);

    const email = await signedInEmail(request, env);
    if (!email) return json({ error: 'Please sign in through Cloudflare Access.' }, 401);
    if (!env.OPS_DB) return json({ error: 'Database unavailable' }, 503);

    const server = new McpServer({ name: 'between-team', version: '0.1.0' });
    registerTools(server, { db: env.OPS_DB, email });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(request);
  },
};
