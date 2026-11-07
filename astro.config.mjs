import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { execSync } from 'node:child_process';

// Which commit this build is, shown in a <meta name="build"> tag and the team sidebar, so "is the new version live?"
// can be answered by looking. A trailing * means the build had uncommitted changes. Workers Builds (if connected)
// supplies WORKERS_CI_COMMIT_SHA; otherwise we ask git.
const git = cmd => execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
let build = (process.env.WORKERS_CI_COMMIT_SHA || '').slice(0, 7);
try { build ||= git('git rev-parse --short HEAD') + (git('git status --porcelain') ? '*' : ''); } catch { build ||= 'unknown'; }

export default defineConfig({
  output: 'static',
  adapter: cloudflare({
    // No component in this project uses astro:assets / <Image> — plain <img>
    // tags throughout — so there's nothing for Astro's image pipeline to
    // compile. 'passthrough' avoids bundling an unused Sharp-dependent image
    // endpoint into the worker (which broke once dynamic API routes were added).
    imageService: 'passthrough',
    sessionKVBindingName: undefined,
    platformProxy: { enabled: true },
  }),
  site: 'https://between.sonicboom.org.uk',
  vite: { define: { __BUILD__: JSON.stringify(build) } },
});
