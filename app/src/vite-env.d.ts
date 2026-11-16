/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

// Runtime settings written to /config.js by the Docker entrypoint (all optional).
interface RuntimeConfig {
  bedrockEnabled?: boolean;
  dxEnabled?: boolean;
  bedrockModelId?: string;
  bedrockGuardrailId?: string;
  bedrockGuardrailVersion?: string;
  defaultRegion?: string;
  defaultScenario?: string;
  appTitle?: string;
  ssoBackendUrl?: string;
  maxToolRounds?: number;
}

interface Window {
  __CONFIG__?: RuntimeConfig;
}
