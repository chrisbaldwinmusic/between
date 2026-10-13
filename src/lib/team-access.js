// Who can see what inside /team. Cloudflare Access already limits /team to sonicboom.org.uk
// addresses; this narrows it further per person.
//
// Leads (Chris, Dan) see and edit everything: dashboard, schedule, to-dos, budget, ops.
// Everyone else signed in gets a read-only view of the dashboard and schedule for now.

export const LEADS = ['chris@sonicboom.org.uk', 'dan@sonicboom.org.uk'];

// Pages and read-only API routes open to everyone signed in.
const SHARED_PAGES = ['/team', '/team/schedule'];
const SHARED_API_READS = ['/api/team/schedule', '/api/team/roster', '/api/team/activity'];

// Activity log entries about lead-only areas are hidden from everyone else.
const LEAD_ONLY_ACTIVITY = ['to-do', 'budget'];

// SQL WHERE clause for the activity log as this person may see it ('' for leads).
export function activityWhere(email) {
  if (isLead(email)) return '';
  return 'WHERE ' + LEAD_ONLY_ACTIVITY.map(w => `action NOT LIKE '%${w}%'`).join(' AND ');
}

export function getEmail(request) {
  return (request.headers.get('Cf-Access-Authenticated-User-Email') || '').toLowerCase() || null;
}

export function isLead(email) {
  // Local dev has no Access header: treat it as a lead so the whole tool can be worked on.
  if (!email) return import.meta.env.DEV;
  return LEADS.includes(email.toLowerCase());
}

function strip(path) {
  return path.replace(/\/$/, '') || '/';
}

// True if this email may load this /team page or call this /api/team route.
export function canAccess(email, pathname, method = 'GET') {
  if (isLead(email)) return true;
  const path = strip(pathname);
  if (path.startsWith('/api/team')) {
    return method === 'GET' && SHARED_API_READS.includes(path);
  }
  return SHARED_PAGES.includes(path);
}
