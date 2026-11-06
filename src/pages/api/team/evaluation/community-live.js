// GET /api/team/evaluation/community-live — today's numbers from the connected accounts, to pre-fill the
// monthly community form. Read-only: nothing is saved until someone presses Save.
//   { values: { email, facebook_page, instagram }, sources: { <key>: { ok, label, asOf } | { ok:false, error } } }
// Only the channels we can genuinely read are filled: the mailer list, the Facebook Page and the Instagram
// account. WhatsApp, Facebook group, Instagram channel and TikTok have no connection, so they stay manual.
// Leads and the community managers (src/middleware.js).

import { metaClient, metaOps } from '../../../../lib/meta.js';
import { mailerSubscribers } from '../../../../lib/mailer.js';
import { jsonOk } from '../../../../lib/ops-db.js';

export const prerender = false;

export async function GET(context) {
  const env = context.locals.runtime?.env ?? {};
  const ops = metaOps(metaClient(env));
  const [mail, fb, ig] = await Promise.allSettled([mailerSubscribers(env), ops.fbPage(), ops.igAccount()]);

  const values = {}, sources = {};
  const asOf = new Date().toISOString();
  const put = (key, label, n, err) => {
    if (Number.isInteger(n)) { values[key] = n; sources[key] = { ok: true, label, asOf }; }
    else sources[key] = { ok: false, error: err || `${label} gave no number.` };
  };

  const m = mail.status === 'fulfilled' ? mail.value : { error: mail.reason?.message };
  put('email', 'Mailer', m.count, m.error);
  put('facebook_page', 'Facebook Page', fb.status === 'fulfilled' ? (fb.value.followers_count ?? fb.value.fan_count) : undefined, fb.reason?.message);
  put('instagram', 'Instagram', ig.status === 'fulfilled' ? ig.value.followers_count : undefined, ig.reason?.message);

  return jsonOk({ values, sources });
}
