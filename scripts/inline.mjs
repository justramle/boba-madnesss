// Turns dist-single/ into one self-contained HTML file: dist-single/boba-madness.html
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-single';
let html = readFileSync(join(dir, 'index.html'), 'utf8');
for (const f of readdirSync(join(dir, 'assets'))) {
  const src = readFileSync(join(dir, 'assets', f), 'utf8');
  if (f.endsWith('.js'))
    html = html.replace(
      new RegExp(`<script[^>]*src="\\./assets/${f}"[^>]*></script>`),
      () => `<script type="module">${src.replace(/<\/script/g, '<\\/script')}</script>`,
    );
  if (f.endsWith('.css'))
    html = html.replace(new RegExp(`<link[^>]*href="\\./assets/${f}"[^>]*>`), () => `<style>${src}</style>`);
}
rmSync(join(dir, 'assets'), { recursive: true, force: true });
rmSync(join(dir, 'index.html'));
writeFileSync(join(dir, 'boba-madness.html'), html);
console.log(`wrote ${dir}/boba-madness.html (${(html.length / 1024).toFixed(0)} kB)`);
