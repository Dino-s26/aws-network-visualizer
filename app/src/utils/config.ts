// Centralized app configuration.
// Precedence: runtime config (window.__CONFIG__, written to /config.js by the Docker
// entrypoint) > build-time VITE_* env vars > defaults.
// See .env.example (build time) and docker-compose.yml (runtime).

import type { MockScenario } from './shared';

// Empty in dev and in tests (no window / empty config.js).
const rt: RuntimeConfig = (typeof window !== 'undefined' && window.__CONFIG__) || {};
const env = import.meta.env;

export const config = {
  /** Amazon Bedrock chat. Off unless enabled at runtime or build time. */
  bedrockEnabled: rt.bedrockEnabled ?? env.VITE_BEDROCK_ENABLED === 'true',

  /** Direct Connect view. On by default; skipped automatically when unavailable. Only the exact value false turns it off. */
  dxEnabled: rt.dxEnabled ?? env.VITE_DX_ENABLED !== 'false',

  /** Bedrock model ID (without cross-region prefix). */
  bedrockModelId: rt.bedrockModelId || env.VITE_BEDROCK_MODEL_ID || 'global.anthropic.claude-opus-5',

  /** Default AWS region used when no credentials are provided. */
  defaultRegion: rt.defaultRegion || env.VITE_DEFAULT_REGION || 'us-east-1',

  /** Max tool-use rounds per chat turn. */
  maxToolRounds: Number(rt.maxToolRounds) || Number(env.VITE_MAX_TOOL_ROUNDS) || 5,

  /** Default mock scenario shown on first load. */
  defaultScenario: (rt.defaultScenario || env.VITE_DEFAULT_SCENARIO || 'noResiliency') as MockScenario,

  /** App title shown in the top bar. */
  appTitle: rt.appTitle || env.VITE_APP_TITLE || 'AWS Network Visualizer',

  /** Bedrock Guardrail identifier (created in the Bedrock console). */
  bedrockGuardrailId: rt.bedrockGuardrailId || env.VITE_BEDROCK_GUARDRAIL_ID || '',

  /** Bedrock Guardrail version (e.g. "1" or "DRAFT"). */
  bedrockGuardrailVersion: rt.bedrockGuardrailVersion || env.VITE_BEDROCK_GUARDRAIL_VERSION || 'DRAFT',

  /** Optional SSO backend URL (validated again in sso-api.ts). */
  ssoBackendUrl: rt.ssoBackendUrl || env.VITE_SSO_BACKEND_URL || '',

  /** App version from package.json, injected at build time. */
  appVersion: __APP_VERSION__,
} as const;
