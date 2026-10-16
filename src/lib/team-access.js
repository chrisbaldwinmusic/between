// Who can see what inside /team. Cloudflare Access already limits /team to sonicboom.org.uk
// addresses; this narrows it further per person.
//
// Leads (Chris, Dan) see and edit everything: dashboard, schedule, to-dos, budget, ops.
// Everyone else signed in gets a read-only view of the dashboard and schedule, can tick off their
// own to-dos, and can upload and manage their own photos and screenshots in /team/media.
// The community managers (Vikki, Emma) also get what their job needs, read-only: approved stories
// (no contributor emails) to share, the survey, community-growth and tracked-link reports, the survey
// preview and the QR posters. Not the budget (it has their own rates), ops, the full to-do list, evaluation
// admin, reviews or the CSV exports.

export const LEADS = ['chris@sonicboom.org.uk', 'dan@sonicboom.org.uk'];
export const COMMUNITY = ['vikki@sonicboom.org.uk', 'emma@sonicboom.org.uk'];

// Pages and read-only API routes open to everyone signed in.
const SHARED_PAGES = ['/team', '/team/schedule', '/team/media'];
const SHARED_API_READS = ['/api/team/schedule', '/api/team/roster'];
const COMMUNITY_PAGES = [
  '/team/stories',
  '/team/evaluation/survey-report',
  '/team/evaluation/community-report',
  '/team/evaluation/attribution',
  '/team/evaluation/qr',
  '/team/evaluation/survey-preview',
];
// Any method; the routes themselves limit deleting to the uploader or a lead.
const SHARED_API_PREFIXES = ['/api/team/media'];

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
    return method === 'GET' && SHARED_API_READS.includes(path);
  }
  return SHARED_PAGES.includes(path) || (isCommunity(email) && COMMUNITY_PAGES.includes(path));
}
