import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// docker/strip-csp-meta.mjs runs during the image build. These tests run it against a
// copy of the real app/index.html, so an upstream change to that file is caught here
// instead of in a failed (or silently wrong) Docker build.
const here = fileURLToPath(new URL('.', import.meta.url));
const script = resolve(here, '../../../docker/strip-csp-meta.mjs');
const realIndex = resolve(here, '../../index.html');
const dirs = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true });
});

function tmpFile(name) {
  const dir = mkdtempSync(join(tmpdir(), 'nwv-'));
  dirs.push(dir);
  return join(dir, name);
}

const strip = (file) => spawnSync(process.execPath, [script, file], { encoding: 'utf8' });

describe('strip-csp-meta', () => {
  it('removes the CSP meta tag from the real index.html and keeps the rest', () => {
    const file = tmpFile('index.html');
    copyFileSync(realIndex, file);
    const res = strip(file);
    expect(res.status).toBe(0);
    const html = readFileSync(file, 'utf8');
    expect(html).not.toContain('Content-Security-Policy');
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('/src/main.tsx');
    expect(html).toContain('<script src="/config.js"></script>');
  });

  it('fails loudly when there is no CSP meta tag, and leaves the file alone', () => {
    const file = tmpFile('index.html');
    writeFileSync(file, '<html><head></head><body></body></html>');
    const res = strip(file);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('not found');
    expect(readFileSync(file, 'utf8')).toBe('<html><head></head><body></body></html>');
  });
});

describe('index.html wiring', () => {
  it('loads /config.js before the app module so window.__CONFIG__ exists first', () => {
    const html = readFileSync(realIndex, 'utf8');
    expect(html.indexOf('/config.js')).toBeGreaterThan(-1);
    expect(html.indexOf('/config.js')).toBeLessThan(html.indexOf('/src/main.tsx'));
  });
});
