import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// nginx quirk: add_header inside a location REPLACES the headers inherited from the
// server block. So every location that sets its own add_header must re-include the
// shared security headers and the generated CSP, or those responses ship unprotected.
const here = fileURLToPath(new URL('.', import.meta.url));
const conf = readFileSync(resolve(here, '../../../docker/nginx.conf'), 'utf8');

const locations = [...conf.matchAll(/location\s+([^{]+)\{([\s\S]*?)\n    \}/g)].map((m) => ({
  path: m[1].trim(),
  body: m[2],
}));

describe('docker/nginx.conf', () => {
  it('parses at least the config, assets and root locations', () => {
    const paths = locations.map((l) => l.path);
    expect(paths).toEqual(expect.arrayContaining(['= /config.js', '/assets/', '/']));
  });

  it('includes the shared headers and the CSP at server level', () => {
    const serverLevel = conf.split(/location\s/)[0];
    expect(serverLevel).toContain('include /etc/nginx/nwv/headers.conf;');
    expect(serverLevel).toContain('include /tmp/nwv/csp.conf;');
  });

  it('re-includes headers.conf and csp.conf in every location that calls add_header', () => {
    for (const loc of locations.filter((l) => l.body.includes('add_header'))) {
      expect(loc.body, `location ${loc.path}`).toContain('include /etc/nginx/nwv/headers.conf;');
      expect(loc.body, `location ${loc.path}`).toContain('include /tmp/nwv/csp.conf;');
    }
  });

  it('never caches the runtime config and serves hashed assets as immutable', () => {
    const cfg = locations.find((l) => l.path === '= /config.js');
    const assets = locations.find((l) => l.path === '/assets/');
    expect(cfg.body).toContain('no-store');
    expect(assets.body).toContain('immutable');
  });
});
