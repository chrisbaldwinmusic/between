// Per-person access inside /team (see src/lib/team-access.js). Cloudflare Access decides who can
// reach /team at all; this verifies that login (signed token, not just the plain email header)
// and then decides which /team pages and API routes each person gets.

import { defineMiddleware } from 'astro:middleware';
import { getEmail, canAccess } from './lib/team-access.js';
import { verifiedAccessEmail } from './lib/access-jwt.js';

const deny = (pathname, status, message) =>
  pathname.startsWith('/api/team')
    ? new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } })
    : new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (!pathname.startsWith('/team') && !pathname.startsWith('/api/team')) return next();

  // Local dev and `wrangler dev` have no Access in front of them. LOCAL_DEV_SKIP_ACCESS_CHECK is
  // only ever set in the git-ignored .dev.vars, never as a production variable or secret.
  const skip = import.meta.env.DEV || context.locals.runtime?.env?.LOCAL_DEV_SKIP_ACCESS_CHECK === '1';
  if (!skip) {
    const verified = await verifiedAccessEmail(context.request);
    const claimed = getEmail(context.request);
    if (!verified || (claimed && claimed !== verified)) {
      return deny(pathname, 401, 'Please sign in through Cloudflare Access to use the team area.');
    }
  }

  const email = getEmail(context.request);
  if (canAccess(email, pathname, context.request.method)) return next();

  if (pathname.startsWith('/api/team')) return deny(pathname, 403, 'Not available to your account');
  return context.redirect('/team', 302);
});
