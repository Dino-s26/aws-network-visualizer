# Checkpoint - AWS Network Visualizer (fork of aws-samples/sample-network-resilience-agent)

Last updated: 2026-11-14

## Goal
Learn the upstream DX visualizer, improve it for the community, ship as a small Docker image (no npm for users), add static VPC reachability (A->B).

## Rules (user)
1. Minimal setup (target: `docker run -p 8080:8080 <image>`, zero required config)
2. Minimize image size (multi-stage, static files only in final image)
3. Public, well-known libraries only
4. Bedrock optional / good-to-have (lazy import, off unless configured)
5. Add flow check across VPCs and related network components
6. Better UI/UX: low friction, user-customizable
7. Minimal animation (respect prefers-reduced-motion)
Priority: simplicity and maintainability. Org rules: no PII/client data, confirm before processing, heads-up before terminal/MCP, checkpoint every 2-4 ops.

## Layout (local)
aws-network-visualizer/
  references/sample-network-resilience-agent/  pristine upstream clone (HEAD 6e109e5, PR #23) - do not edit
  app/      working copy of dx-visualizer (Phase 1 starts here)
  docker/   Dockerfile, nginx.conf, entrypoint (to write)
  docs/     this checkpoint

## Upstream facts (README + code review)
- Static SPA, no app server. AWS SDK v3 called from the browser with user-entered temp creds.
- Stack: React 19, TS 6, Vite 8, Tailwind v4, @xyflow/react 12, Zustand 5, driver.js, html-to-image, react-markdown. Node >= 22. vitest.
- src/: api/ (AWS calls), engine/ (pure rules/layout, ~65 tests + fixtures), store/, chat/ (Bedrock), components/, utils/ (cidr.ts exists).
- backend/ = optional SSO Lambda (SAM/CFN). Not needed for minimal setup (Access Key login works).
- Hotspot god-files: useExportReport.ts 4564 LOC, layout-engine 2381, topology-store 2342, ResiliencyScoreCard 2214, topology-builder 2090, bestpractice-rules 1946.

## Design findings that drive the work
- Build-time env baked in: VITE_BEDROCK_MODEL_ID, _GUARDRAIL_ID/_VERSION, VITE_DEFAULT_REGION, VITE_SSO_BACKEND_URL, VITE_APP_TITLE, VITE_DEFAULT_SCENARIO, VITE_MAX_TOOL_ROUNDS. Central file: src/utils/config.ts -> read window.__CONFIG__ first, fall back to import.meta.env.
- CSP is a <meta> tag in index.html with connect-src allowlist -> move CSP/security headers to nginx.conf so runtime SSO URL works.
- Bedrock / Cost Explorer / Pricing SDK clients serve chat only -> lazy import, optional.
- Reachability gap (grep = 0 refs): subnets, subnet-RT associations, NACLs, SGs/rules, ENIs, TGW RT associations, prefix lists are NOT fetched. Already fetched: VPCs, VPC RTs, TGW + RTs + SearchTransitGatewayRoutes + propagations, peerings, VPN/VGW, DX.
- Caching audit: upstream has NO API/topology cache (refresh = refetch). Only in-memory utilization/prompt/route caches; localStorage = UI customizations only. useUnloadCleaner wipes on pagehide, 15 min idle timeout: respect this.

## Decisions (approved)
- Reachability = static A->B trace: SG egress -> NACL out -> route LPM -> TGW/peering/VGW hops -> dest return route -> NACL in/out -> SG ingress (+ return path). Pure engine/reachability/ + tests; UI panel highlights first failing hop. v1 out of scope: Network Firewall, GWLB, VPC endpoints, DNS, on-prem beyond learned BGP.
- Cache: in-memory TTL (api/cache.ts, default 5 min, Refresh bypasses, data-age badge) in Phase 2. Persistent cache = IndexedDB behind CacheStore {get,put,delete,list}+TTL, DEFAULT OFF, sanitized topology only, never credentials, "Clear local data" button; restore-last-view reuses snapshot import (read-only). Phase 3.
- SQLite-wasm (@sqlite.org/sqlite-wasm + OPFS opfs-sahpool) optional Phase 4 behind same interface. Server-side SQLite sidecar rejected.

## Phases
1. Docker: multi-stage (node build -> nginx-unprivileged alpine), runtime config.js, nginx CSP/headers, Bedrock optional, compose, GHCR CI. Done when `docker run` loads demo data with zero config; report real image size.
2. Reachability: 2a data layer + TTL cache + extra read-only IAM policy, 2b pure engine + fixture tests, 2c UI panel.
3. UI/UX: settings store (theme, density, motion), reduced animation, CacheStore + restore-last-view, simpler first run, split god-files only when touched.
4. Optional: SQLite-wasm history/drift, Flow Logs, Network Firewall/VPCe/BGP, Reachability Analyzer cross-check, community packaging (rules as one file each, CONTRIBUTING).

## Status
- DONE: README + code review, reference clone, app/docker/docs scaffold, app/ = copy of dx-visualizer.
- NEXT: Phase 1. First read app/.env.example, app/index.html (CSP), app/src/utils/config.ts. Then write docker/Dockerfile, nginx.conf, entrypoint; build and report size.
- Open: git init for app/ (suggested), license note (upstream MIT-0, lightningcss MPL-2.0 dev-only: keep in build stage).
