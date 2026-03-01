// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://blog.hai-hs.in/',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      langAlias: {
        pycon: 'python',
        python3: 'python',
        irb: 'ruby',
        'html+jinja': 'html',
        'html+django': 'html',
        'shell-session': 'bash',
      },
      theme: 'andromeeda',
    },
  },
});
