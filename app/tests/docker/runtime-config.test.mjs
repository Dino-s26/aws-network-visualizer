import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs docker/40-runtime-config.sh for real (sh) with a controlled environment and
// checks the two files it writes: config.js (browser) and csp.conf (nginx header).
const here = fileURLToPath(new URL('.', import.meta.url));
const script = resolve(here, '../../../docker/40-runtime-config.sh');
const dirs = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true });
});

function run(env = {}) {
  const out = mkdtempSync(join(tmpdir(), 'nwv-'));
  dirs.push(out);
  // Only PATH from the host, so a developer's own BEDROCK_* vars cannot leak in.
  const res = spawnSync('sh', [script], {
    env: { PATH: process.env.PATH, NWV_OUT: out, ...env },
    encoding: 'utf8',
  });
  if (res.status !== 0) throw new Error(`script failed (${res.status}): ${res.stderr}`);
  const js = readFileSync(join(out, 'config.js'), 'utf8');
  const csp = readFileSync(join(out, 'csp.conf'), 'utf8');
  const win = {};
  new Function('window', js)(win); // must be valid JS that only sets window.__CONFIG__
  return { win, cfg: win.__CONFIG__, js, csp };
}

const directive = (csp, name) => (csp.match(new RegExp(`${name} ([^;]*)`)) || [])[1];

describe('config.js', () => {
  it('writes empty defaults with Bedrock off', () => {
    const { cfg } = run();
    expect(cfg).toEqual({
      bedrockEnabled: false,
      bedrockModelId: '',
      bedrockGuardrailId: '',
      bedrockGuardrailVersion: '',
      defaultRegion: '',
      defaultScenario: '',
      appTitle: '',
      ssoBackendUrl: '',
      maxToolRounds: 0,
    });
  });

  it('passes simple values through', () => {
    const { cfg } = run({
      BEDROCK_ENABLED: 'true',
      BEDROCK_MODEL_ID: 'global.anthropic.claude-opus-5',
      BEDROCK_GUARDRAIL_VERSION: '3',
      DEFAULT_REGION: 'eu-west-1',
      DEFAULT_SCENARIO: 'high',
      APP_TITLE: 'My Network Viz',
      MAX_TOOL_ROUNDS: '7',
    });
    expect(cfg.bedrockEnabled).toBe(true);
    expect(cfg.bedrockModelId).toBe('global.anthropic.claude-opus-5');
    expect(cfg.bedrockGuardrailVersion).toBe('3');
    expect(cfg.defaultRegion).toBe('eu-west-1');
    expect(cfg.defaultScenario).toBe('high');
    expect(cfg.appTitle).toBe('My Network Viz');
    expect(cfg.maxToolRounds).toBe(7);
  });

  it('enables Bedrock only for the exact string "true"', () => {
    expect(run({ BEDROCK_ENABLED: 'yes' }).cfg.bedrockEnabled).toBe(false);
    expect(run({ BEDROCK_ENABLED: 'TRUE' }).cfg.bedrockEnabled).toBe(false);
    expect(run({ BEDROCK_ENABLED: '1' }).cfg.bedrockEnabled).toBe(false);
  });

  it('strips script-injection characters from string values', () => {
    const { win, cfg } = run({ APP_TITLE: 'x"; window.pwned=1; //' });
    expect(Object.keys(win)).toEqual(['__CONFIG__']);
    expect(cfg.appTitle).toMatch(/^[A-Za-z0-9 ._:/@+=-]*$/);
    expect(cfg.appTitle).not.toMatch(/["';()]/);
  });

  it('cannot be broken out of with a newline', () => {
    const { win, cfg } = run({ APP_TITLE: 'a\nwindow.pwned=1' });
    expect(Object.keys(win)).toEqual(['__CONFIG__']);
    expect(cfg.appTitle).not.toContain('\n');
  });

  it('keeps only digits in MAX_TOOL_ROUNDS', () => {
    expect(run({ MAX_TOOL_ROUNDS: '7x' }).cfg.maxToolRounds).toBe(7);
    expect(run({ MAX_TOOL_ROUNDS: 'abc' }).cfg.maxToolRounds).toBe(0);
  });
});

describe('csp.conf', () => {
  it('is one nginx add_header line with a locked-down baseline', () => {
    const { csp } = run();
    expect(csp.startsWith('add_header Content-Security-Policy "')).toBe(true);
    expect(csp.trimEnd().endsWith('" always;')).toBe(true);
    expect(csp.trimEnd().split('\n')).toHaveLength(1);
    expect(directive(csp, 'script-src')).toBe("'self'");
    expect(directive(csp, 'object-src')).toBe("'none'");
    expect(directive(csp, 'frame-ancestors')).toBe("'none'");
    expect(csp).not.toContain('unsafe-eval');
    expect(directive(csp, 'connect-src')).toBe("'self' https://*.amazonaws.com");
  });

  it('adds only the origin of SSO_BACKEND_URL (no path)', () => {
    const { csp } = run({ SSO_BACKEND_URL: 'https://sso.example.com/prod/auth' });
    expect(directive(csp, 'connect-src')).toBe("'self' https://*.amazonaws.com https://sso.example.com");
  });

  it('keeps a port in the SSO origin and allows http://localhost for dev', () => {
    expect(directive(run({ SSO_BACKEND_URL: 'https://sso.example.com:8443/x' }).csp, 'connect-src')).toContain(
      'https://sso.example.com:8443',
    );
    expect(directive(run({ SSO_BACKEND_URL: 'http://localhost:3001' }).csp, 'connect-src')).toContain(
      'http://localhost:3001',
    );
  });

  it('ignores SSO URLs that are not http(s) origins', () => {
    const base = "'self' https://*.amazonaws.com";
    expect(directive(run({ SSO_BACKEND_URL: 'javascript:alert(1)' }).csp, 'connect-src')).toBe(base);
    expect(directive(run({ SSO_BACKEND_URL: 'ftp://x.example.com' }).csp, 'connect-src')).toBe(base);
  });

  it('adds valid CSP_CONNECT_EXTRA origins, including wildcards, and drops junk', () => {
    const { csp } = run({ CSP_CONNECT_EXTRA: 'https://a.example.com https://*.b.example.com not-a-url' });
    const connect = directive(csp, 'connect-src');
    expect(connect).toContain('https://a.example.com');
    expect(connect).toContain('https://*.b.example.com');
    expect(connect).not.toContain('not-a-url');
  });

  it('cannot inject extra nginx directives through CSP_CONNECT_EXTRA', () => {
    const { csp } = run({ CSP_CONNECT_EXTRA: 'https://a.example.com"; add_header X-Evil 1; #' });
    expect(csp.split('add_header').length - 1).toBe(1);
    expect(csp).not.toContain('X-Evil');
    expect(directive(csp, 'connect-src')).toContain('https://a.example.com');
  });
});
