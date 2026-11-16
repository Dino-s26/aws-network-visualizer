# CLAUDE.md - AWS Network Visualizer

Project memory for Claude (chat or Claude Code). History and detail live in `docs/checkpoint.md`; read its last few checkpoints first. If the two disagree, checkpoint.md is newer.

## What this is
A community fork of aws-samples/sample-network-resilience-agent. **Focus: VPC observability** (topology map, security posture, static reachability). Direct Connect (the upstream focus) is kept as an optional, best-effort layer. Ships as a small Docker image with zero required config.

## Layout
- `app/`        web app (React 19, TypeScript, Vite, Tailwind v4, @xyflow/react, Zustand, AWS SDK v3 in the browser). All code changes go here.
- `docker/`     Dockerfile (stages: deps, test, build, final nginx), nginx.conf, headers.conf, 40-runtime-config.sh, strip-csp-meta.mjs.
- `docs/`       checkpoint.md, this file.
- `references/` optional, git-ignored local clone of upstream. Never edit, never commit.

## Commands (run from the project root)
- All tests in a container (no local install): `docker build -f docker/Dockerfile --target test .`
- Production image (also runs tsc): `docker build -f docker/Dockerfile -t aws-network-visualizer:dev .`
- Run hardened: `docker run -d --name nwv --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true -p 127.0.0.1:8080:8080 aws-network-visualizer:dev`
- From source (Node >= 22, in app/): `npm ci`, `npm run dev`, `npm test`, `npm run build`.

## Project rules (from the user)
1. Minimal setup: one `docker run`, no required config.
2. Keep the image small: static files on nginx-unprivileged alpine (about 62 MB).
3. Publicly known libraries only; avoid new dependencies when a small function will do.
4. Bedrock chat is optional: off unless BEDROCK_ENABLED=true; lazy-loaded.
5. Direct Connect is ON by default but best-effort: if unavailable (none, no permission, unreachable) skip it quietly and show VPC resources. A top-bar switch turns it off; DX_ENABLED=false locks it off for the deployment.
6. UI/UX: low friction, user-customizable, minimal animation (honor prefers-reduced-motion).
7. Simple, easy-to-maintain code. User knows Python and bash well, some Go; explain plainly.

## Working agreements (org rules, always follow)
- No PII or sensitive client data. Never write real account IDs, resource IDs, local usernames or local paths into the repo, docs, tests or checkpoints. Confirm information before processing it.
- Ask about the end goal and propose a plan before acting.
- Before any terminal or MCP call: say what runs and the impact. Ask before installs, builds that start containers, deletions, commits, pushes.
- Checkpoint every 2-4 operations by appending to docs/checkpoint.md.
- The user runs git commits and pushes unless they explicitly delegate. Branch names: `feat/xxx`.
- Keep answers short and token-efficient.

## Architecture notes
- Static SPA, no app server. The browser calls AWS with credentials the user enters; nothing is stored server-side. Credentials are never persisted; localStorage holds UI preferences only.
- Runtime config: container env -> `docker/40-runtime-config.sh` (whitelists characters) -> `/tmp/nwv/config.js` (window.__CONFIG__) and `/tmp/nwv/csp.conf`. `app/src/utils/config.ts` precedence: runtime > VITE_* build env > defaults. nginx sends the CSP and security headers; the CSP meta tag is stripped at image build.
- Fetching: `app/src/api/fetch-topology.ts` sweeps every enabled region (DescribeRegions; not DX-dependent). Each call is wrapped: `logged()` records a FetchIssue and returns [] on failure (drives the incomplete-data banner).
- Direct Connect: `app/src/api/dx-optional.ts`. `loggedDx()` takes a thunk, never calls when DX is off or already denied, never records a FetchIssue. Outcome is `TopologyData.dxStatus` (ok | off | none | unavailable). Partial DX data is stripped when unavailable. `app/src/utils/dx-preference.ts` + `components/DxToggle.tsx` give the user switch; the deployment setting wins.
- Upstream canvas, layout engine, resilience rules, score card and report are DX-shaped. VPC-only estates currently land in an "Unattached resources" table; the new VPC view replaces that experience.
- Large upstream files (touch carefully, split only when needed): useExportReport.ts, layout-engine.ts, topology-store.ts, ResiliencyScoreCard.tsx, topology-builder.ts, bestpractice-rules.ts.

## Conventions for new work
- New VPC code goes in new modules under `app/src/vpc/` (model, api, engine, components). Keep edits to upstream files small so upstream merges stay easy.
- Engines are pure functions over a normalized model, with fixture tests. Reuse `app/src/utils/cidr.ts`.
- Tests: logic tests next to code in `__tests__` (vitest). Tests that need Node APIs or run docker scripts go in `app/tests/` as `.mjs` (tsc only knows vite/client types under src).
- Verify every change with the container test stage and the production build before calling it done. Say plainly what was not verified.
- Multi-file edits: use an all-or-nothing script that checks each snippet matches exactly once before writing.

## Reachability scope (static, A to B)
Route tables (longest prefix), SGs, NACLs, TGW (attachments, route tables, propagations, blackholes), peering, VPN/VGW, DX paths, IGW/NAT, VPC endpoints, Network Firewall (stateless + simple 5-tuple stateful). Verdicts: PASS / FAIL / INCONCLUSIVE; never guess. Out of v1: GWLB, DNS, endpoint-policy/IAM evaluation, domain/SNI/Suricata-complex rules, on-prem beyond learned BGP.

## Phases and status
1. Docker image, runtime config, security headers, optional Bedrock, self-hosted fonts, tests: DONE, merged.
2a-1. Direct Connect best-effort (backend, config, top-bar switch): BUILT, 1400 tests pass, on branch feat/dx-best-effort, not yet committed.
2a-2. Normalized VPC model + fetchers + synthetic demo dataset: NEXT.
2b. VPC topology map (Region > VPC > AZ > subnet, collapsed by default, detail panel).
2c. Security posture rules + findings panel (open SGs, permissive NACLs, internet-reachable ENIs, blackhole/missing return routes, overlapping CIDRs, flow logs disabled, unused default VPCs).
2d. Reachability core, then IGW/NAT, endpoints, Network Firewall.
3. UI/UX settings, reduced motion, optional local cache (IndexedDB behind a CacheStore interface, off by default).
4. Optional: Flow Logs analysis, scan history (SQLite-wasm), CI (GitHub Actions: test stage, image build, GHCR).

## Licensing
Project is Apache-2.0 (see LICENSE, NOTICE). Upstream is MIT-0. Dev-only deps with other licenses must stay in the build stage; the final image holds built static output only.
