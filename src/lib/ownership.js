// Who owns a to-do or schedule item. Owners are written as full roster names ("Vikki Asker",
// "Vikki Asker & Emma Buckley"); match whole names only so a short name can't match inside another.

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function nameMatcher(names) {
  const res = names.filter(Boolean).map(n => new RegExp(`(^|[^A-Za-z])${escape(n)}($|[^A-Za-z])`, 'i'));
  return owner => Boolean(owner) && res.some(re => re.test(owner));
}

/** The roster name for a sign-in email, or null. */
export async function rosterName(db, email) {
  if (!db || !email) return null;
  const row = await db.prepare('SELECT name FROM team_members WHERE lower(email) = ?').bind(email.toLowerCase()).first();
  return row?.name ?? null;
}
