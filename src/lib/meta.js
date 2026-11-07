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
  // Facebook video (Reels, video Stories) is a three-step upload. Step two POSTs to a rupload.facebook.com
  // address Meta gave us, telling it which public file to fetch (the file_url header).
  async function rupload(uploadUrl, fileUrl) {
    if (!token) throw new MetaError('Meta is not connected yet: META_ACCESS_TOKEN is not set.', 503);
    if (!/^https:\/\/rupload\.facebook\.com\//.test(uploadUrl || '')) throw new MetaError('Meta sent an unexpected upload address.', 502);
    let res;
    try { res = await fetchImpl(uploadUrl, { method: 'POST', headers: { Authorization: `OAuth ${token}`, file_url: fileUrl } }); }
    catch (err) { throw new MetaError(scrub(`Could not reach Meta: ${err.message}`), 502); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false || body.error) throw new MetaError(scrub(`Meta ${res.status}: ${body.error?.message || 'the video upload failed'}`), 502);
    return body;
  }
  const need = (what, v) => { if (!v) throw new MetaError(`${what} is not configured.`, 503); return v; };
  // Facebook Page reads and writes want a Page access token. A system-user or user token can mint one for
  // the Page; we do that once, lazily, and use it for Facebook only (Instagram keeps the configured token).
  // If Meta won't issue one (or the configured token already is a Page token) we fall back to the configured
  // token, and the call's own error says what is wrong.
  let pageClientP;
  const pageClient = () => (pageClientP ??= (async () => {
    try {
      const t = (await call('GET', need('META_PAGE_ID', env.META_PAGE_ID), { fields: 'access_token' })).access_token;
      if (t && t !== token) return metaClient({ ...env, META_ACCESS_TOKEN: t }, fetchImpl);
    } catch { /* fall back */ }
    return null;
  })());
  const viaPage = name => async (...a) => ((await pageClient()) ?? self)[name](...a);
  const self = {
    configured: !!token, version,
    pageId: () => need('META_PAGE_ID', env.META_PAGE_ID),
    igId: () => need('META_IG_USER_ID', env.META_IG_USER_ID),
    ids: { page: env.META_PAGE_ID || null, instagram: env.META_IG_USER_ID || null },
    get: (p, q) => call('GET', p, q),
    post: (p, q) => call('POST', p, q),
    rupload,
    page: { get: viaPage('get'), post: viaPage('post'), rupload: viaPage('rupload') },
  };
  return self;
}

const checkId = id => { if (!ID.test(String(id ?? ''))) throw new MetaError('Invalid id.'); return String(id); };
// Every image we publish: a public https URL, alt text, and a consent check (CLAUDE.md rule 3; photo
// consents live at /team/consents).
function imageChecks(image_url, alt_text, consent_ok) {
  if (!/^https:\/\//.test(image_url || '')) throw new MetaError('image_url must be a public https URL to a JPEG.');
  if (!alt_text?.trim()) throw new MetaError('Add alt text: every image needs a description.');
  if (consent_ok !== true) throw new MetaError('Confirm that anyone you can recognise in the image has given photo consent (see /team/consents), or that nobody is recognisable.');
}

export const FORMATS = ['post', 'carousel', 'story', 'reel'];
const formatOf = f => { const x = f ?? 'post'; if (!FORMATS.includes(x)) throw new MetaError(`format must be one of: ${FORMATS.join(', ')}.`); return x; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Carousels: 2 to 10 photos, each with its own alt text.
function carouselChecks(images, consent_ok) {
  if (!Array.isArray(images) || images.length < 2 || images.length > 10) throw new MetaError('A carousel needs 2 to 10 photos.');
  images.forEach((im, i) => {
    try { imageChecks(im?.url, im?.alt, consent_ok); }
    catch (err) { throw new MetaError(`Photo ${i + 1}: ${err.message}`); }
  });
}
// Videos (Reels, video Stories): a public https MP4 or MOV, a description for the record, photo/video
// consent, and captions. Instagram and Facebook can't attach alt text to video, so the team confirms
// that anything spoken is also on screen (CLAUDE.md rule 3).
function videoChecks(video_url, description, consent_ok, captions_ok) {
  if (!/^https:\/\//.test(video_url || '')) throw new MetaError('video_url must be a public https URL to an MP4 or MOV.');
  if (!description?.trim()) throw new MetaError('Describe the video: what happens, who is in it.');
  if (consent_ok !== true) throw new MetaError('Confirm that anyone you can recognise or hear in the video has given video consent (see /team/consents), or that nobody is recognisable.');
  if (captions_ok !== true) throw new MetaError('Confirm that anything spoken or sung is captioned on screen, or that there is nothing spoken.');
}
// A Story or Reel is one image or one video; Reels are video only.
function singleMedia(format, { image_url, video_url, alt_text, consent_ok, captions_ok }) {
  if (image_url && video_url) throw new MetaError('Choose one image or one video.');
  if (format === 'reel' && !video_url) throw new MetaError('A Reel needs a video.');
  if (!image_url && !video_url) throw new MetaError(`A ${format} needs an image or a video.`);
  if (video_url) videoChecks(video_url, alt_text, consent_ok, captions_ok);
  else imageChecks(image_url, alt_text, consent_ok);
}
const noSchedule = (format, schedule_at) => {
  if (schedule_at && format !== 'post' && format !== 'carousel') throw new MetaError(`${format === 'story' ? 'Stories' : 'Reels'} can't be scheduled from here. Post it when it is ready.`);
};

// Instagram makes a "container" first and needs it processed before it can be published; video takes a while.
async function containerReady(m, id, budgetMs = 40000) {
  const end = Date.now() + budgetMs;
  for (;;) {
    const s = await m.get(id, { fields: 'status_code,status' });
    if (s.status_code === 'FINISHED') return true;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new MetaError(`Instagram could not process the media${s.status ? `: ${s.status}` : '.'}`, 502);
    if (Date.now() + 3000 > end) return false;
    await sleep(3000);
  }
}
async function igPublishContainer(m, id) {
  if (!(await containerReady(m, id))) return { sent: false, pending: true, creation_id: id, note: 'Instagram is still processing the video. It has not been published yet.' };
  return m.post(`${m.igId()}/media_publish`, { creation_id: id });
}

const gate = async (ok, action, payload, go) =>
  ok ? { sent: true, ...(await go()) }
     : { sent: false, preview: { action, ...payload }, note: 'Nothing was sent. Confirm to go ahead.' };

// Shared reads and validated writes. `m` is a metaClient.
export function metaOps(m) {
  const fb = m.page ?? m;   // Facebook calls go through the Page token
  return {
    status: async () => {
      const out = { connected: m.configured, apiVersion: m.version, ...m.ids };
      if (!m.configured) return out;
      return { ...out, tokenOwner: await m.get('me', { fields: 'id,name' }) };
    },
    fbPage: () => fb.get(m.pageId(), { fields: 'id,name,about,category,followers_count,fan_count,website,link,instagram_business_account{id,username}' }),
    igAccount: () => m.get(m.igId(), { fields: 'id,username,name,biography,followers_count,follows_count,media_count,website' }),
    fbPosts: ({ limit = 10, scheduled = false } = {}) => fb.get(`${m.pageId()}/${scheduled ? 'scheduled_posts' : 'posts'}`, {
      limit, fields: 'id,message,created_time,scheduled_publish_time,permalink_url,full_picture,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)',
    }),
    igMedia: ({ limit = 10 } = {}) => m.get(`${m.igId()}/media`, { limit, fields: 'id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,timestamp,like_count,comments_count' }),
    fbComments: ({ id, limit = 20 }) => fb.get(`${checkId(id)}/comments`, { limit, order: 'reverse_chronological', fields: 'id,message,created_time,from,like_count,comment_count,is_hidden' }),
    igComments: ({ id, limit = 20 }) => m.get(`${checkId(id)}/comments`, { limit, fields: 'id,text,username,timestamp,like_count,hidden,replies{id,text,username,timestamp}' }),

    publishFacebook: async ({ format: f, message = '', link, image_url, images, video_url, alt_text, consent_ok, captions_ok, schedule_at, confirm }) => {
      const format = formatOf(f);
      noSchedule(format, schedule_at);
      const when = schedule_at ? Math.floor(new Date(schedule_at).getTime() / 1000) : null;
      if (schedule_at && (!when || when < Date.now() / 1000 + 600)) throw new MetaError('Schedule at least 10 minutes ahead.');
      const sched = when ? { published: 'false', scheduled_publish_time: when } : {};
      const when_ = schedule_at ?? 'now';

      if (format === 'post') {
        if (!message?.trim() || message.length > 5000) throw new MetaError('Write a message (up to 5000 characters).');
        utmCheck(message, link);
        if (image_url) {
          imageChecks(image_url, alt_text, consent_ok);
          if (link) throw new MetaError('A photo post can\'t also carry a link: put the link (with UTMs) in the message instead.');
        }
        return gate(confirm, image_url ? 'Publish a photo to Facebook Page' : 'Publish to Facebook Page',
          { message, link, image_url, alt_text, scheduled_for: when_ },
          () => (image_url
            ? fb.post(`${m.pageId()}/photos`, { url: image_url, caption: message, alt_text_custom: alt_text, ...sched })
            : fb.post(`${m.pageId()}/feed`, { message, link, ...sched })));
      }

      if (format === 'carousel') {
        // Facebook calls this a multi-photo post: upload each photo unpublished, then attach them all to one post.
        if (!message?.trim() || message.length > 5000) throw new MetaError('Write a message (up to 5000 characters).');
        utmCheck(message);
        carouselChecks(images, consent_ok);
        return gate(confirm, `Publish ${images.length} photos to Facebook Page`,
          { message, images, scheduled_for: when_ },
          async () => {
            const ids = [];
            for (const im of images) ids.push((await fb.post(`${m.pageId()}/photos`, { url: im.url, alt_text_custom: im.alt, published: 'false' })).id);
            const attached = Object.fromEntries(ids.map((id, i) => [`attached_media[${i}]`, JSON.stringify({ media_fbid: id })]));
            return fb.post(`${m.pageId()}/feed`, { message, ...attached, ...sched });
          });
      }

      singleMedia(format, { image_url, video_url, alt_text, consent_ok, captions_ok });
      if (format === 'story') {
        // Facebook Stories carry no caption: any words go on the image or video itself.
        return gate(confirm, `Publish a ${video_url ? 'video' : 'photo'} Story to Facebook Page`, { image_url, video_url, alt_text },
          async () => {
            if (video_url) {
              const start = await fb.post(`${m.pageId()}/video_stories`, { upload_phase: 'start' });
              await fb.rupload(start.upload_url, video_url);
              return fb.post(`${m.pageId()}/video_stories`, { upload_phase: 'finish', video_id: start.video_id });
            }
            const photo = await fb.post(`${m.pageId()}/photos`, { url: image_url, alt_text_custom: alt_text, published: 'false' });
            return fb.post(`${m.pageId()}/photo_stories`, { photo_id: photo.id });
          });
      }
      // reel
      if (message.length > 2200) throw new MetaError('Reel captions are up to 2200 characters.');
      utmCheck(message);
      return gate(confirm, 'Publish a Reel to Facebook Page', { message, video_url, alt_text },
        async () => {
          const start = await fb.post(`${m.pageId()}/video_reels`, { upload_phase: 'start' });
          await fb.rupload(start.upload_url, video_url);
          return fb.post(`${m.pageId()}/video_reels`, { upload_phase: 'finish', video_id: start.video_id, video_state: 'PUBLISHED', description: message });
        });
    },

    publishInstagram: async ({ format: f, image_url, images, video_url, caption = '', alt_text, consent_ok, captions_ok, confirm }) => {
      const format = formatOf(f);
      if (caption.length > 2200) throw new MetaError('Instagram captions are up to 2200 characters.');
      utmCheck(caption);

      if (format === 'post') {
        imageChecks(image_url, alt_text, consent_ok);
        return gate(confirm, 'Publish to Instagram', { image_url, caption, alt_text }, async () => {
          const container = await m.post(`${m.igId()}/media`, { image_url, caption, alt_text });
          return m.post(`${m.igId()}/media_publish`, { creation_id: container.id });
        });
      }
      if (format === 'carousel') {
        carouselChecks(images, consent_ok);
        return gate(confirm, `Publish a ${images.length}-photo carousel to Instagram`, { images, caption }, async () => {
          const kids = [];
          for (const im of images) kids.push((await m.post(`${m.igId()}/media`, { image_url: im.url, alt_text: im.alt, is_carousel_item: 'true' })).id);
          const parent = await m.post(`${m.igId()}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption });
          return igPublishContainer(m, parent.id);
        });
      }
      singleMedia(format, { image_url, video_url, alt_text, consent_ok, captions_ok });
      if (format === 'story') {
        // Instagram Stories carry no caption and no alt text through the API.
        return gate(confirm, `Publish a ${video_url ? 'video' : 'photo'} Story to Instagram`, { image_url, video_url, alt_text }, async () => {
          const c = await m.post(`${m.igId()}/media`, { media_type: 'STORIES', ...(video_url ? { video_url } : { image_url }) });
          return igPublishContainer(m, c.id);
        });
      }
      return gate(confirm, 'Publish a Reel to Instagram', { video_url, caption, alt_text }, async () => {
        const c = await m.post(`${m.igId()}/media`, { media_type: 'REELS', video_url, caption, share_to_feed: 'true' });
        return igPublishContainer(m, c.id);
      });
    },
    // Video can take longer than one request to process: the page (or the MCP caller) asks again with the
    // creation_id from the "pending" answer until it publishes.
    finishInstagram: async ({ creation_id, confirm }) => {
      checkId(creation_id);
      return gate(confirm, 'Finish publishing to Instagram', { creation_id }, () => igPublishContainer(m, creation_id));
    },
    reply: async ({ platform, comment_id, message, confirm }) => {
      if (!['facebook', 'instagram'].includes(platform)) throw new MetaError('platform must be facebook or instagram.');
      if (!message?.trim() || message.length > 2200) throw new MetaError('Write a reply (up to 2200 characters).');
      utmCheck(message);
      checkId(comment_id);
      return gate(confirm, `Reply on ${platform}`, { comment_id, message },
        () => (platform === 'facebook' ? fb : m).post(`${comment_id}/${platform === 'facebook' ? 'comments' : 'replies'}`, { message }));
    },
    hide: async ({ platform, comment_id, hidden, confirm }) => {
      if (!['facebook', 'instagram'].includes(platform)) throw new MetaError('platform must be facebook or instagram.');
      checkId(comment_id);
      return gate(confirm, `${hidden ? 'Hide' : 'Unhide'} ${platform} comment`, { comment_id },
        () => (platform === 'facebook' ? fb : m).post(comment_id, { [platform === 'facebook' ? 'is_hidden' : 'hide']: !!hidden }));
    },
  };
}
