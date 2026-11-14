// Build-time helper: remove the CSP <meta> tag (nginx sends the CSP header instead).
// Fails loudly if the tag is missing so a silent change in index.html is noticed.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
const html = readFileSync(file, 'utf8');
const out = html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/, '');
if (out === html) {
  console.error('CSP meta tag not found in', file);
  process.exit(1);
}
writeFileSync(file, out);
console.log('Removed CSP meta tag from', file);
