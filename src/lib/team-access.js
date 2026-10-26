// Who can see what inside /team. Cloudflare Access already limits /team to sonicboom.org.uk
// addresses; this narrows it further per person.
//
// Leads (Chris, Dan) see and edit everything: dashboard, schedule, to-dos, budget, ops.
// Everyone else signed in gets a read-only view of the dashboard and schedule, can tick off their
// own to-dos, and can upload and manage their own photos and screenshots in /team/media.
// The community managers (Vikki, Emma) also get what their job needs, read-only: approved stories
// (no contributor emails) to share, the survey, community-growth and tracked-link reports, the survey
// preview and the QR posters. They can also enter the monthly community numbers on /team/evaluation
// (not lock or unlock a month) and download the community-growth CSV (counts only). Not the budget (it
// has their own rates), ops, the full to-do list, the rest of evaluation, reviews or the other exports.

export const LEADS = ['chris@sonicboom.org.uk', 'dan@sonicboom.org.uk'];
export const COMMUNITY = ['vikki@sonicboom.org.uk', 'emma@sonicboom.org.uk'];

// Pages and read-only API routes open to everyone signed in.
const SHARED_PAGES = ['/team', '/team/schedule', '/team/media', '/team/help'];
const SHARED_API_READS = ['/api/team/schedule', '/api/team/roster'];
const COMMUNITY_PAGES = [
  '/team/evaluation',
  '/team/stories',
  '/team/evaluation/survey-report',
  '/team/evaluation/community-report',
  '/team/evaluation/attribution',
  '/team/evaluation/qr',
  '/team/evaluation/survey-preview',
];
// Any method; the routes themselves limit deleting to the uploader or a lead, and push
// subscriptions to the signed-in person's own devices.
// Community managers only. The routes check what they may do: no locking months, community CSV only.
const COMMUNITY_API = [
  { method: 'POST', path: '/api/team/evaluation/community' },
  { method: 'GET', path: '/api/team/evaluation/export' },
];
const SHARED_API_PREFIXES = ['/api/team/media', '/api/team/push'];

export function getEmail(request) {
  return (request.headers.get('Cf-Access-Authenticated-User-Email') || '').toLowerCase() || null;
}

export function isLead(email) {
  // Local dev has no Access header: treat it as a lead so the whole tool can be worked on.
  if (!email) return import.meta.env.DEV;
  return LEADS.includes(email.toLowerCase());
}

export function isCommunity(email) {
  return !!email && COMMUNITY.includes(email.toLowerCase());
}

function strip(path) {
  return path.replace(/\/$/, '') || '/';
}

// True if this email may load this /team page or call this /api/team route.
export function canAccess(email, pathname, method = 'GET') {
  if (isLead(email)) return true;
  const path = strip(pathname);
  if (path.startsWith('/api/team')) {
    if (SHARED_API_PREFIXES.some(p => path === p || path.startsWith(`${p}/`))) return true;
    // Ticking off their own to-dos (the route checks ownership).
    if (method === 'PATCH' && /^\/api\/team\/todos\/\d+$/.test(path)) return true;
    if (isCommunity(email) && COMMUNITY_API.some(r => r.method === method && r.path === path)) return true;
    return method === 'GET' && SHARED_API_READS.includes(path);
  }
  return SHARED_PAGES.includes(path) || (isCommunity(email) && COMMUNITY_PAGES.includes(path));
}
