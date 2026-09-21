import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

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
});
