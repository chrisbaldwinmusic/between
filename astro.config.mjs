import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',
  adapter: cloudflare({ imageService: 'compile', sessionKVBindingName: undefined }),
  site: 'https://between.sonicboom.org.uk',
});
