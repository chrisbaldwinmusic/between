// Suggested replies to public comments, one per call to action (the ways people can join in). Pure text:
// the inbox pre-fills the reply box with one and the team edits it before sending. Rules: warm and local,
// Sonic Boom Music CIC in full, the venue is our AMBITION (never confirmed, dated or sized), every link
// carries UTMs, only our own pages are linked.

export const SITE = 'https://between.sonicboom.org.uk';
export const SIGN_OFF = 'Believe in the Power of Music.';

// key, label for the picker, the capture it points to, and the utm_campaign for it.
export const CTAS = [
  { key: 'story', label: 'Invite their story', path: '/feedback/story', campaign: 'story-invite' },
  { key: 'poll', label: 'Venue poll', path: '/#the-ambition', campaign: 'venue-poll' },
  { key: 'join', label: 'Join the community', path: '/#signup', campaign: 'join-community' },
  { key: 'thanks', label: 'Just say thanks', path: null, campaign: null },
  { key: 'own', label: 'Write my own', path: null, campaign: null },
];
export const CTA_KEYS = CTAS.map(c => c.key);

const link = (cta, platform) => {
  const c = CTAS.find(x => x.key === cta);
  const [path, hash] = c.path.split('#');
  return `${SITE}${path === '/' ? '/' : path}?utm_source=${platform}&utm_medium=comment-reply&utm_campaign=${c.campaign}${hash ? `#${hash}` : ''}`;
};

export function replyText(cta, platform) {
  switch (cta) {
    case 'story':
      return `Thank you, that means a lot. If you'd like to tell us more, you can share your story here: ${link('story', platform)} It's optional, and you choose whether we share it. ${SIGN_OFF}`;
    case 'poll':
      return `Thank you, this is exactly what we want to hear. We're building the case for a permanent grassroots venue in Burton, if the demand is there. Add your voice here: ${link('poll', platform)} ${SIGN_OFF}`;
    case 'join':
      return `Thank you! To hear about the next one first, join the community here: ${link('join', platform)} ${SIGN_OFF}`;
    case 'own':
      return '';
    default:
      return `Thank you, that really means a lot to us. ${SIGN_OFF}`;
  }
}

// Which call to action fits a comment: its themes first (saved tags, else suggested ones), then a few
// plain phrases. Anything that raises a concern gets no suggestion: a person should write that reply.
export function suggestCta(themes = '', text = '') {
  const t = new Set(String(themes).split(',').filter(Boolean));
  if (t.has('concern')) return null;
  if (t.has('venue_demand')) return 'poll';
  if (['first_time', 'family', 'young_people', 'not_a_fan'].some(k => t.has(k))) return 'story';
  if (/can'?t make it|couldn'?t make it|gutted|missed (it|this|out)|sorry i missed/i.test(text)) return 'join';
  if (t.has('community') || t.has('praise')) return 'join';
  return 'thanks';
}

// Links in a reply must be to our own site (the server checks this before anything is sent).
export const linksOutsideSite = (s = '') => (s.match(/https?:\/\/[^\s)]+/g) ?? []).filter(u => !u.startsWith(`${SITE}/`));
// A reply that asks someone to share something (anything but a plain thanks, including your own wording) is only for adults.
export const needsAdultCheck = cta => cta !== 'thanks';
