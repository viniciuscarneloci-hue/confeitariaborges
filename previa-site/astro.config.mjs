import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://previa.vercel.app',
  build: { inlineStylesheets: 'always' },
  vite: { build: { assetsInlineLimit: 0 } },
});
