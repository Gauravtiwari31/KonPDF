// Turns the built single-page shell into one pre-rendered HTML file per page,
// so search engines and AdSense see real content, then writes robots.txt,
// sitemap.xml, ads.txt and Cloudflare Pages' _headers.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const site = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));
const { pages } = await import(pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href);

const escape = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
// AdSense shows the ID as "pub-…" or "ca-pub-…"; the script wants "ca-pub-…".
const pub = (site.adsenseClient || '').trim().replace(/^ca-/, '');
const adsense = /^pub-\d{10,20}$/.test(pub) ? `ca-${pub}` : null;
const shell = readFileSync(join(dist, 'index.html'), 'utf8');

for (const page of pages) {
  const url = `${site.url}${page.path === '/' ? '/' : page.path}`;
  const head = [
    `<meta name="description" content="${escape(page.description)}" />`,
    page.path === '/404' ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="KonPDF" />`,
    `<meta property="og:title" content="${escape(page.title)}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${site.url}/og.png" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    adsense
      ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}" crossorigin="anonymous"></script>`
      : '',
  ]
    .filter(Boolean)
    .join('\n    ');
  const html = shell
    .replace('<!--head-->', head)
    .replace('<title>KonPDF</title>', `<title>${escape(page.title)}</title>`)
    .replace('<!--app-->', page.html);
  const file = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`;
  writeFileSync(join(dist, file), html);
}

const listed = pages.filter(p => p.path !== '/404');
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${listed
    .map(p => `  <url><loc>${site.url}${p.path === '/' ? '/' : p.path}</loc></url>`)
    .join('\n')}\n</urlset>\n`,
);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
if (adsense) {
  writeFileSync(join(dist, 'ads.txt'), `google.com, ${adsense.replace('ca-', '')}, DIRECT, f08c47fec0942fa0\n`);
}
writeFileSync(
  join(dist, '_headers'),
  [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=()',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n'),
);
rmSync(join(root, 'dist-ssr'), { recursive: true, force: true });
console.log(`Pre-rendered ${pages.length} pages${adsense ? `, ads.txt for ${adsense}` : ' (no AdSense ID set: ads off)'}.`);
