import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';
import { DEFAULT_IMAGE, ORGANIZATION_JSON_LD, SEO_PAGES, SITE, SITE_NAME, type SeoPage } from './src/seo/seoRoutes';

// Build step: the site is one page that draws itself in the browser, so every
// address used to send search engines the same empty HTML titled "Next Star
// Soccer". After the build this writes each public page's own HTML file (the
// same app, with that page's title, description, canonical address, social
// preview and, on the home page, the business details for search engines),
// plus sitemap.xml. Vercel serves /services from services.html (cleanUrls).

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const headFor = (template: string, page: SeoPage) => {
  const url = `${SITE}${page.path === '/' ? '/' : page.path}`;
  const image = page.image || DEFAULT_IMAGE;
  const tags = [
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    ...(page.path === '/' ? [`<script type="application/ld+json">${JSON.stringify(ORGANIZATION_JSON_LD)}</script>`] : []),
  ];
  const out = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(page.description)}" />`)
    .replace('</head>', `    ${tags.join('\n    ')}\n  </head>`);
  if (!out.includes(`<title>${esc(page.title)}</title>`)) throw new Error(`seo-pages: couldn't set the title for ${page.path}`);
  return out;
};

export const seoPages = (): Plugin => ({
  name: 'seo-pages',
  apply: 'build',
  closeBundle() {
    const dist = path.resolve(__dirname, 'dist');
    const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    for (const page of SEO_PAGES) {
      const file = path.join(dist, page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, headFor(template, page));
    }
    const urls = SEO_PAGES.map((p) => `  <url><loc>${esc(`${SITE}${p.path}`)}</loc></url>`).join('\n');
    fs.writeFileSync(
      path.join(dist, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    );
    console.log(`seo-pages: ${SEO_PAGES.length} pages and sitemap.xml`);
  },
});
