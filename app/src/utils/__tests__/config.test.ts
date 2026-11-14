import { describe, it, expect, afterEach, vi } from 'vitest';

// config.ts reads window.__CONFIG__ and import.meta.env once, when the module loads.
// Each test sets its inputs, clears the module cache, then imports a fresh copy.
const ENV_KEYS = [
  'VITE_BEDROCK_ENABLED',
  'VITE_BEDROCK_MODEL_ID',
  'VITE_DEFAULT_REGION',
  'VITE_MAX_TOOL_ROUNDS',
  'VITE_DEFAULT_SCENARIO',
  'VITE_APP_TITLE',
  'VITE_BEDROCK_GUARDRAIL_ID',
  'VITE_BEDROCK_GUARDRAIL_VERSION',
  'VITE_SSO_BACKEND_URL',
];

async function loadConfig(opts: { runtime?: RuntimeConfig; env?: Record<string, string> } = {}) {
  vi.resetModules();
  // Blank every key first so a developer's local .env cannot leak into the test.
  for (const key of ENV_KEYS) vi.stubEnv(key, '');
  for (const [key, value] of Object.entries(opts.env ?? {})) vi.stubEnv(key, value);
  if (opts.runtime) vi.stubGlobal('window', { __CONFIG__: opts.runtime });
  return (await import('../config')).config;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('config defaults', () => {
  it('loads without a window (node/test) and uses safe defaults', async () => {
    expect(typeof window).toBe('undefined');
    const c = await loadConfig();
    expect(c.bedrockEnabled).toBe(false);
    expect(c.bedrockModelId).toBe('global.anthropic.claude-opus-5');
    expect(c.defaultRegion).toBe('us-east-1');
    expect(c.maxToolRounds).toBe(5);
    expect(c.defaultScenario).toBe('noResiliency');
    expect(c.appTitle).toBe('Network Resilience Agent');
    expect(c.bedrockGuardrailId).toBe('');
    expect(c.bedrockGuardrailVersion).toBe('DRAFT');
    expect(c.ssoBackendUrl).toBe('');
  });
});

describe('config precedence', () => {
  it('falls back to build-time env vars when there is no runtime config', async () => {
    const c = await loadConfig({
      env: {
        VITE_DEFAULT_REGION: 'eu-west-1',
        VITE_BEDROCK_ENABLED: 'true',
        VITE_MAX_TOOL_ROUNDS: '9',
        VITE_SSO_BACKEND_URL: 'https://sso.example.com',
      },
    });
    expect(c.defaultRegion).toBe('eu-west-1');
    expect(c.bedrockEnabled).toBe(true);
    expect(c.maxToolRounds).toBe(9);
    expect(c.ssoBackendUrl).toBe('https://sso.example.com');
  });

  it('lets runtime values override build-time env vars', async () => {
    const c = await loadConfig({
      env: { VITE_DEFAULT_REGION: 'eu-west-1' },
      runtime: { defaultRegion: 'ap-southeast-1', appTitle: 'My Viz' },
    });
    expect(c.defaultRegion).toBe('ap-southeast-1');
    expect(c.appTitle).toBe('My Viz');
  });

  it('treats empty runtime strings as unset (the entrypoint writes "" for unset vars)', async () => {
    const c = await loadConfig({
      env: { VITE_DEFAULT_REGION: 'eu-west-1' },
      runtime: {
        defaultRegion: '',
        appTitle: '',
        bedrockModelId: '',
        bedrockGuardrailVersion: '',
        ssoBackendUrl: '',
      },
    });
    expect(c.defaultRegion).toBe('eu-west-1');
    expect(c.appTitle).toBe('Network Resilience Agent');
    expect(c.bedrockModelId).toBe('global.anthropic.claude-opus-5');
    expect(c.bedrockGuardrailVersion).toBe('DRAFT');
    expect(c.ssoBackendUrl).toBe('');
  });
});

describe('bedrockEnabled', () => {
  it('is off by default', async () => {
    expect((await loadConfig()).bedrockEnabled).toBe(false);
  });

  it('turns on from runtime config alone', async () => {
    expect((await loadConfig({ runtime: { bedrockEnabled: true } })).bedrockEnabled).toBe(true);
  });

  it('lets an explicit runtime false beat a build-time true', async () => {
    const c = await loadConfig({ env: { VITE_BEDROCK_ENABLED: 'true' }, runtime: { bedrockEnabled: false } });
    expect(c.bedrockEnabled).toBe(false);
  });

  it('only accepts the exact string "true" from the build-time env', async () => {
    expect((await loadConfig({ env: { VITE_BEDROCK_ENABLED: 'yes' } })).bedrockEnabled).toBe(false);
    expect((await loadConfig({ env: { VITE_BEDROCK_ENABLED: 'TRUE' } })).bedrockEnabled).toBe(false);
  });
});

describe('maxToolRounds', () => {
  it('uses the runtime value when it is a positive number', async () => {
    expect((await loadConfig({ runtime: { maxToolRounds: 4 } })).maxToolRounds).toBe(4);
  });

  it('treats runtime 0 as unset and falls through to env, then to 5', async () => {
    expect((await loadConfig({ runtime: { maxToolRounds: 0 }, env: { VITE_MAX_TOOL_ROUNDS: '7' } })).maxToolRounds).toBe(7);
    expect((await loadConfig({ runtime: { maxToolRounds: 0 } })).maxToolRounds).toBe(5);
  });

  it('ignores a non-numeric build-time value', async () => {
    expect((await loadConfig({ env: { VITE_MAX_TOOL_ROUNDS: 'abc' } })).maxToolRounds).toBe(5);
  });
});
