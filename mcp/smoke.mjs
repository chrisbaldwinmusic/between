// Post-deploy smoke test for the team MCP Worker. Run after `npm run deploy:mcp`; exits non-zero on
// any surprise. Signed-in behaviour (roles, tools) can't be tested here: it needs an Access login,
// so check that by connecting a client (DEPLOY.md, MCP section).
const BASE = process.env.SMOKE_MCP_BASE || 'https://mcp.between.sonicboom.org.uk';
const post = { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: '{}' };
// Access answers first with a redirect to login (302) or a refusal (401/403); the Worker's own
// refusal is 401. Anything that gets a tool list without signing in is a failure.
const checks = [
  ['/health', {}, [200, 302], 'health'],
  ['/mcp', post, [302, 401, 403], 'MCP endpoint refuses anonymous requests'],
  ['/nope', {}, [302, 401, 403, 404], 'unknown path'],
];
let failed = 0;
for (const [path, init, ok, what] of checks) {
  let status;
  try { status = (await fetch(BASE + path, { redirect: 'manual', ...init })).status; }
  catch (err) { status = `error: ${err.message}`; }
  const pass = ok.includes(status);
  if (!pass) failed++;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${path.padEnd(10)} ${status}  ${what}`);
}
if (failed) {
  console.error(`\n${failed} check(s) failed. Roll back with \`npx wrangler rollback --config mcp/wrangler.toml\`.`);
  process.exit(1);
}
