// Per-person access inside /team (see src/lib/team-access.js). Cloudflare Access handles who can
// reach the site at all; this decides which /team pages and API routes each person gets.

import { defineMiddleware } from 'astro:middleware';
import { getEmail, canAccess } from './lib/team-access.js';

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;
  if (!pathname.startsWith('/team') && !pathname.startsWith('/api/team')) return next();

  const email = getEmail(context.request);
  if (canAccess(email, pathname, context.request.method)) return next();

  if (pathname.startsWith('/api/team')) {
    return new Response(JSON.stringify({ error: 'Not available to your account' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return context.redirect('/team', 302);
});
