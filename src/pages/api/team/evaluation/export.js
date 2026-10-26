// GET /api/team/evaluation/export?type=survey|checkins|community — CSV of raw (anonymous) responses
// and monthly community numbers for reporting. Leads only (src/middleware.js), except that the community
// managers can download type=community (counts only, no personal data).

import { getDb, jsonErr } from '../../../../lib/ops-db.js';
import { getEmail, isLead } from '../../../../lib/team-access.js';

export const prerender = false;

const QUERIES = {
  survey: 'SELECT id, event_slug, created_at, heard_from, prior_events, outward_postcode, venue_use, venue_wants FROM feedback_responses ORDER BY created_at',
  checkins: 'SELECT id, event_slug, created_at, party_size, first_time, outward_postcode FROM checkins ORDER BY created_at',
  community: 'SELECT month, whatsapp, email, facebook_page, facebook_group, instagram, instagram_channel, tiktok, locked_at, locked_by FROM community_counts ORDER BY month',
};

const cell = v => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const type = new URL(context.request.url).searchParams.get('type');
  if (!QUERIES[type]) return jsonErr('type must be survey, checkins or community', 400);

  if (type !== 'community' && !isLead(getEmail(context.request))) return jsonErr('Not available to your account', 403);

  const { results } = await db.prepare(QUERIES[type]).all();
  const cols = QUERIES[type].match(/SELECT (.*) FROM/)[1].split(', ');
  const csv = [cols.join(','), ...results.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="between-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
