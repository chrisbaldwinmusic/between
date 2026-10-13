// Post-deploy smoke test: checks the live site answers as expected on its key routes. Run by
// `npm run deploy` straight after `wrangler deploy`; exits non-zero (and says why) on any surprise.
const BASE = process.env.SMOKE_BASE || 'https://between.sonicboom.org.uk';
const checks = [
  ['/', [200, 401], 'home (PIN page while in preview)'],
  ['/feedback', [200], 'feedback hub (open)'],
  ['/feedback/firelight', [200], 'survey page (open)'],
  ['/privacy', [200], 'privacy notice (open)'],
  ['/team', [302], 'team area (behind Cloudflare Access)'],
  ['/api/team/budget', [302], 'team API (behind Cloudflare Access)'],
];
let failed = 0;
for (const [path, ok, what] of checks) {
  let status;
  try {
    status = (await fetch(BASE + path, { redirect: 'manual', headers: { Accept: 'text/html' } })).status;
  } catch (err) {
    status = `error: ${err.message}`;
  }
  const pass = ok.includes(status);
  if (!pass) failed++;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${path.padEnd(22)} ${status}  ${what}`);
}
if (failed) {
  console.error(`\n${failed} check(s) failed: the live site may be broken. Roll back with \`npx wrangler rollback\` if needed.`);
  process.exit(1);
}
