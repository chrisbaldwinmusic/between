// Help for each /team page, in one place: shown in the "How this page works" fold-out at the top
// of that page (src/components/TeamHelp.astro) and gathered on /team/help (the "Help guide"). Pages appear only to people who can open them (canAccess). Each entry can have
// different tips for leads and for everyone else.

export const PAGE_HELP = [
  {
    path: '/team',
    title: 'Dashboard',
    what: "Your starting point: what's in progress, your own to-dos and who's on the team.",
    tips: [
      'Your to-dos are at the top. Tick one off when it\'s done; dated ones also come in your daily email (and as a notification, if you\'ve turned them on) until you do.',
      'The roster shows everyone on the project, with their email.',
    ],
    community: [
      '"Surveys and stories to share" lists each event\'s survey and QR poster from the 1st of the event\'s month, plus the stories and reports you can use.',
    ],
    lead: ['Click a roster status pill to cycle it: Confirmed, Expected, Unconfirmed.'],
  },
  {
    path: '/team/schedule',
    title: 'Schedule',
    what: 'The project plan from now to the end-of-programme report, month by month.',
    tips: [
      "Status follows today's date unless something is marked blocked or done.",
      "Event dates aren't fixed until tickets go on sale, so plan by the month, not the day.",
    ],
    lead: ['Click a status badge to cycle it, add notes inline, or add and remove items.'],
  },
  {
    path: '/team/todos',
    title: 'To-dos',
    what: 'Everything that needs doing, grouped by area, live and shared.',
    tips: [
      'Tick things off, add new ones and reassign them as they move.',
      "Give a to-do a due date and it goes in the owner's daily email on the day, then nudges for two days if it's overdue.",
    ],
  },
  {
    path: '/team/budget',
    title: 'Budget',
    what: 'The live tracker against the Arts Council England application budget.',
    tips: ['Use "+ Log an entry" (or the + on a line) to record spending or income against a budget line.'],
  },
  {
    path: '/team/evaluation',
    title: 'Evaluation',
    what: 'The evaluation plan run live: surveys, attendance, debriefs, monthly community numbers and the reviews.',
    tips: [
      'After each event, fill in its checklist (survey sent, attendance, debrief) and lock it when the numbers are final.',
      "Record the community numbers each month. Previews of the survey and the QR posters for each event are under Coming up from the 1st of the event's month.",
      'Daily emails: preview or send either email by hand.',
    ],
  },
  {
    path: '/team/evaluation/survey-preview',
    title: 'Survey preview',
    what: 'The post-event survey exactly as people will see it, with the links to share it.',
    tips: [
      "Copy the link for the channel you're posting on (WhatsApp, Facebook, Instagram, TikTok, email). Each one is tracked, so we can see which channels bring answers in.",
      'Share it the day after the event, while it\'s fresh, and once more three days later.',
      "Nothing can be sent from the preview. The real survey opens on the day of the event.",
    ],
  },
  {
    path: '/team/reviews',
    title: 'Reviews',
    what: 'Every review checkpoint from the schedule, with its period and whether the write-up is done.',
    tips: ['Open a review to see its numbers, pulled live from the evaluation data, then write it up and sign it off.'],
  },
  {
    path: '/team/stories',
    title: 'Stories',
    what: "People's stories from /feedback/story, the heart of what we share.",
    tips: [
      'Only share a story on social media where it says "OK for social media", and keep the wording and credit as they are.',
      'Heard a good story? Ask permission, then send them to /feedback/story to tell it in their own words.',
    ],
    lead: [
      'Approve a story and it appears on the home page straight away. Tidy the wording first if needed (keep their voice).',
      "Approving or not using a story deletes the contributor's email, as promised on the form.",
    ],
  },
  {
    path: '/team/media',
    title: 'Media',
    what: 'Photos from events and screenshots of what people said online, private to the team.',
    tips: [
      'Upload from your phone straight after the event. Location and camera details are removed before upload.',
      "Only photograph people who are happy to be photographed, and say who's in shot in the caption.",
      'You can edit or delete your own uploads.',
    ],
  },
  {
    path: '/team/ops',
    title: 'Ops',
    what: 'Standing procedures from the Arts Council England application.',
    tips: ['Edit the page in the code to keep it current.'],
  },
];

/** The help entry for this exact page, if it has one. Sub-pages (QR posters, reports) don't inherit
 *  their section's help: it's about a different page, and often one this person can't open. */
export function helpFor(pathname) {
  const path = pathname.replace(/\/$/, '') || '/team';
  return PAGE_HELP.find(h => h.path === path) ?? null;
}

/** The tips for this person: everyone's, then the leads' or the community managers' extras. */
export function tipsFor(entry, { lead, community }) {
  return [...entry.tips, ...(lead ? entry.lead ?? [] : []), ...(community ? entry.community ?? [] : [])];
}
