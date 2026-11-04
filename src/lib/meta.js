// Facebook Page + Instagram, via the Meta Graph API. Shared by the /team/social page
// (src/pages/api/team/social.js) and the team MCP server (mcp/meta.js), so both enforce the same rules.
//
// One long-lived system-user (or Page) token, held as the Worker secret META_ACCESS_TOKEN, is sent in
// an Authorization header (never in a URL) and scrubbed from error text. Nothing here invents data:
// with no token configured, every call says Meta is not connected.
//
// Config (wrangler.toml [vars] on the site Worker and on mcp/wrangler.toml; the token is a secret):
//   META_ACCESS_TOKEN   secret   `npx wrangler secret put META_ACCESS_TOKEN` (and again with --config mcp/wrangler.toml)
//   META_PAGE_ID        var      Facebook Page id
//   META_IG_USER_ID     var      Instagram professional account id linked to the Page
//   META_API_VERSION    var      optional, defaults below
//
// Writes are outward-facing and hard to undo, so each needs confirm: true; without it they return a
// preview and send nothing. There are no deletes (comments can be hidden, which is reversible).

const DEFAULT_VERSION = 'v23.0'; // TODO: bump to the current Graph API version when you set this up.
const GRAPH = 'https://graph.facebook.com';
const UTM = /[?&]utm_source=/;
const URL_RE = /https?:\/\/[^\s)]+/g;
const ID = /^[0-9_]+$/;

export class MetaError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Every link we publish must carry UTMs (CLAUDE.md hard rule 6).
export function linksMissingUtm(s = '') {
  return (s.match(URL_RE) ?? []).filter(u => !UTM.test(u));
}
function utmCheck(...texts) {
  const bad = texts.flatMap(t => linksMissingUtm(t || ''));
  if (bad.length) throw new MetaError(`Every link must carry UTM parameters (utm_source, utm_medium, utm_campaign). Missing on: ${bad.join(', ')}`);
}

export function metaClient(env = {}, fetchImpl = fetch) {
  const token = env.META_ACCESS_TOKEN || '';
  const version = env.META_API_VERSION || DEFAULT_VERSION;
  const scrub = s => (token ? String(s).split(token).join('[token]') : String(s));

  async function call(method, path, params = {}) {
    if (!token) throw new MetaError('Meta is not connected yet: META_ACCESS_TOKEN is not set.', 503);
    if (!/^\/?[A-Za-z0-9_./-]+$/.test(path) || path.includes('..')) throw new MetaError('Invalid Graph path.');
    const url = new URL(`${GRAPH}/${version}/${path.replace(/^\//, '')}`);
    const init = { method, headers: { Authorization: `Bearer ${token}` } };
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null));
    if (method === 'GET') for (const [k, v] of Object.entries(clean)) url.searchParams.set(k, String(v));
    else {
      init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      init.body = new URLSearchParams(Object.entries(clean).map(([k, v]) => [k, String(v)]));
    }
    let res;
    try { res = await fetchImpl(url, init); } catch (err) { throw new MetaError(scrub(`Could not reach Meta: ${err.message}`), 502); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      const e = body.error || {};
      throw new MetaError(scrub(`Meta ${res.status}${e.code ? ` (code ${e.code})` : ''}: ${e.message || 'request failed'}`), 502);
    }
    return body;
  }
  const need = (what, v) => { if (!v) throw new MetaError(`${what} is not configured.`, 503); return v; };
  return {
    configured: !!token, version,
    pageId: () => need('META_PAGE_ID', env.META_PAGE_ID),
    igId: () => need('META_IG_USER_ID', env.META_IG_USER_ID),
    ids: { page: env.META_PAGE_ID || null, instagram: env.META_IG_USER_ID || null },
    get: (p, q) => call('GET', p, q),
    post: (p, q) => call('POST', p, q),
  };
}

const checkId = id => { if (!ID.test(String(id ?? ''))) throw new MetaError('Invalid id.'); return String(id); };
const gate = async (ok, action, payload, go) =>
  ok ? { sent: true, ...(await go()) }
     : { sent: false, preview: { action, ...payload }, note: 'Nothing was sent. Confirm to go ahead.' };

// Shared reads and validated writes. `m` is a metaClient.
export function metaOps(m) {
  return {
    status: async () => {
      const out = { connected: m.configured, apiVersion: m.version, ...m.ids };
      if (!m.configured) return out;
      return { ...out, tokenOwner: await m.get('me', { fields: 'id,name' }) };
    },
    fbPage: () => m.get(m.pageId(), { fields: 'id,name,about,category,followers_count,fan_count,website,link,instagram_business_account{id,username}' }),
    igAccount: () => m.get(m.igId(), { fields: 'id,username,name,biography,followers_count,follows_count,media_count,website' }),
    fbPosts: ({ limit = 10, scheduled = false } = {}) => m.get(`${m.pageId()}/${scheduled ? 'scheduled_posts' : 'posts'}`, {
      limit, fields: 'id,message,created_time,scheduled_publish_time,permalink_url,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)',
    }),
    igMedia: ({ limit = 10 } = {}) => m.get(`${m.igId()}/media`, { limit, fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count' }),
    fbComments: ({ id, limit = 20 }) => m.get(`${checkId(id)}/comments`, { limit, order: 'reverse_chronological', fields: 'id,message,created_time,from,like_count,comment_count,is_hidden' }),
    igComments: ({ id, limit = 20 }) => m.get(`${checkId(id)}/comments`, { limit, fields: 'id,text,username,timestamp,like_count,hidden,replies{id,text,username,timestamp}' }),

    publishFacebook: async ({ message, link, schedule_at, confirm }) => {
      if (!message?.trim() || message.length > 5000) throw new MetaError('Write a message (up to 5000 characters).');
      utmCheck(message, link);
      const when = schedule_at ? Math.floor(new Date(schedule_at).getTime() / 1000) : null;
      if (schedule_at && (!when || when < Date.now() / 1000 + 600)) throw new MetaError('Schedule at least 10 minutes ahead.');
      return gate(confirm, 'Publish to Facebook Page', { message, link, scheduled_for: schedule_at ?? 'now' },
        () => m.post(`${m.pageId()}/feed`, { message, link, ...(when ? { published: 'false', scheduled_publish_time: when } : {}) }));
    },
    publishInstagram: async ({ image_url, caption = '', alt_text, confirm }) => {
      if (!/^https:\/\//.test(image_url || '')) throw new MetaError('image_url must be a public https URL to a JPEG.');
      if (caption.length > 2200) throw new MetaError('Instagram captions are up to 2200 characters.');
      if (!alt_text?.trim()) throw new MetaError('Add alt text: every image needs a description.');
      utmCheck(caption);
      return gate(confirm, 'Publish to Instagram', { image_url, caption, alt_text }, async () => {
        const container = await m.post(`${m.igId()}/media`, { image_url, caption, alt_text });
        return m.post(`${m.igId()}/media_publish`, { creation_id: container.id });
      });
    },
    reply: async ({ platform, comment_id, message, confirm }) => {
      if (!['facebook', 'instagram'].includes(platform)) throw new MetaError('platform must be facebook or instagram.');
      if (!message?.trim() || message.length > 2200) throw new MetaError('Write a reply (up to 2200 characters).');
      utmCheck(message);
      checkId(comment_id);
      return gate(confirm, `Reply on ${platform}`, { comment_id, message },
        () => m.post(`${comment_id}/${platform === 'facebook' ? 'comments' : 'replies'}`, { message }));
    },
    hide: async ({ platform, comment_id, hidden, confirm }) => {
      if (!['facebook', 'instagram'].includes(platform)) throw new MetaError('platform must be facebook or instagram.');
      checkId(comment_id);
      return gate(confirm, `${hidden ? 'Hide' : 'Unhide'} ${platform} comment`, { comment_id },
        () => m.post(comment_id, { [platform === 'facebook' ? 'is_hidden' : 'hide']: !!hidden }));
    },
  };
}
