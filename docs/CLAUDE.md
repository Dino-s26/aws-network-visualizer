# CLAUDE.md - AWS Network Visualizer

Project memory for Claude (chat or Claude Code). Details and history live in `docs/checkpoint.md`; read it first. If the two disagree, checkpoint.md is newer.

## What this is
A community-friendly fork of aws-samples/sample-network-resilience-agent (AWS Direct Connect topology visualizer, resilience recommendations, optional Bedrock chat). Goals: ship as a small Docker image with zero required config, add static VPC reachability tracing (A -> B), improve UX.

## Layout
- `references/sample-network-resilience-agent/`  pristine upstream clone (HEAD 6e109e5). READ-ONLY, never edit.
- `app/`     working copy of upstream `dx-visualizer/` (React 19, TS, Vite 8, Tailwind v4, @xyflow/react, Zustand, AWS SDK v3). All code changes go here.
- `docker/`  Dockerfile, nginx.conf, entrypoint (Phase 1).
- `docs/`    checkpoint.md, this file.
Upstream `backend/` (SSO Lambda) is optional and stays in references for now.

## Commands (from upstream package.json; run inside app/)
- `npm ci` install, `npm run dev` dev server (:5173, mock data), `npm run build` (tsc -b + vite build -> dist/), `npm run preview`, `npm test` (vitest), `npm run lint`.
- Node >= 22 required.

## Project rules (from the user)
1. Minimal setup: target `docker run -p 8080:8080 <image>`, no required config.
2. Minimize Docker image size: multi-stage, final image holds static files only (nginx-unprivileged alpine).
3. Use publicly known libraries only; avoid niche dependencies.
4. Bedrock is optional (lazy import, off unless configured; chat hidden when off).
5. Add flow checks across VPCs and related network components (static reachability first).
6. Fix UI/UX: low friction, user-customizable settings.
7. Minimal animation; honor prefers-reduced-motion.
Priority: simple, easy-to-maintain code.

## Working agreements (org rules, always follow)
- Do not process PII or sensitive client data. Logo and org-unit info is fine. Confirm any information before processing it.
- Ask clarifying questions about the end goal before starting a task; propose a plan and action first.
- Before running any terminal command or MCP call, give a heads-up: what runs and what the impact is. Ask before installs, image builds, container starts or config changes.
- Create a checkpoint every 2-4 operations (append to docs/checkpoint.md) so context is not lost.
- Keep answers short and token-efficient. Straight explanations; layman terms if needed. User knows Python and bash well, little Go.
- Never edit references/. Never commit credentials.

## Architecture notes (upstream, verified by code review)
- Static SPA, no app server. Browser calls AWS directly with user-entered temp credentials (SSO optional via backend, Access Key works without it).
- `src/api/` AWS calls (fetch-topology.ts has 5 phases: global, discover regions, per-region, merge, optional spoke enrichment). `src/engine/` pure rule, layout and recommendation logic with ~65 tests and fixtures. `src/store/` Zustand. `src/chat/` Bedrock. `src/utils/cidr.ts` CIDR helpers (reuse for longest-prefix match).
- Build-time env baked in: VITE_BEDROCK_MODEL_ID, VITE_BEDROCK_GUARDRAIL_ID/VERSION, VITE_DEFAULT_REGION, VITE_SSO_BACKEND_URL, VITE_APP_TITLE, VITE_DEFAULT_SCENARIO, VITE_MAX_TOOL_ROUNDS. Central file: `src/utils/config.ts`.
- CSP lives in a <meta> tag in index.html (connect-src allowlist).
- Security posture to preserve: wipe on pagehide (useUnloadCleaner), 15 min idle timeout, credentials never persisted, localStorage holds UI customizations only.
- Large files (be careful, split only when touched): useExportReport.ts 4564 LOC, layout-engine 2381, topology-store 2342, ResiliencyScoreCard 2214, topology-builder 2090, bestpractice-rules 1946.

## Key design decisions
- Docker: runtime `window.__CONFIG__` (generated config.js) instead of build-time VITE_*; move CSP and security headers into nginx.conf; Bedrock/CostExplorer/Pricing clients lazy-loaded.
- Reachability (static A -> B): SG egress, NACL out, route LPM, TGW/peering/VGW hops, destination return route, NACL in/out, SG ingress, plus return path. Pure `engine/reachability/` with fixture tests; UI panel highlights first failing hop. New fetches needed: subnets, subnet-RT associations, NACLs, SGs and rules, ENIs, TGW RT associations, prefix lists (extra read-only IAM). v1 also covers IGW/NAT, VPC endpoints (gateway and interface) and Network Firewall (stateless + simple 5-tuple stateful rules; anything it cannot evaluate statically is reported INCONCLUSIVE, never guessed). Verdicts are PASS / FAIL / INCONCLUSIVE. v1 excludes GWLB, DNS resolution, endpoint-policy/IAM evaluation, domain/SNI/Suricata-complex firewall rules, and on-prem beyond learned BGP. Phase 2 is split 2a data layer, 2b engine core, 2c engine extensions, 2d UI.
- Caching: in-memory TTL cache (api/cache.ts, 5 min default, Refresh bypasses, data-age badge) in Phase 2. Persistent cache = IndexedDB behind `CacheStore {get,put,delete,list}` with TTL, DEFAULT OFF, sanitized topology only, "Clear local data" button; restore-last-view reuses snapshot import. SQLite-wasm is an optional Phase 4 swap. No server-side database.

## Phases and status
1. Docker image + runtime config + nginx headers + Bedrock optional + compose + GHCR CI  (NEXT)
2. Reachability: data layer + TTL cache, pure engine + tests, UI panel
3. UI/UX settings, reduced motion, CacheStore + restore-last-view, simpler first run
4. Optional: SQLite-wasm history/drift, Flow Logs, Network Firewall/VPCe/BGP, Reachability Analyzer cross-check, community packaging
Done so far: README and code review, reference clone, app/docker/docs scaffold.
Phase 1 first reads: app/.env.example, app/index.html (CSP), app/src/utils/config.ts.

## Licensing
Upstream is MIT-0. Dev-only deps lightningcss (MPL-2.0) and caniuse-lite (CC-BY-4.0) must stay in the build stage; final image contains built static output only.
