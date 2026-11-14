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

---
# Checkpoint 4 (2026-11-14)

## Done
- Project root now has: README.md (draft, marks Docker/reachability as planned), NOTICE (credits upstream MIT-0), LICENSE (Apache-2.0, verified 202 lines / 11358 bytes, taken from raw.githubusercontent.com/apache/maven/master/LICENSE).
- docs/CLAUDE.md created (project memory for Claude).
- Project root is a git repo (.git present, set up by user). references/ keeps upstream origin (read-only); app/ is a plain copy tracked by the root repo.

## Environment facts (user machine, macOS)
- Docker 29.9.3, Node v26.13.0 (meets >=22), git 2.56.0. No proxy configured.
- Reachable: github.com, raw.githubusercontent.com, registry.npmjs.org, Docker Hub, ghcr.io.
- BLOCKED: www.apache.org (DNS resolves, connection times out; local resolver 127.0.2.2). Use GitHub mirrors for Apache assets.

## Open items
- NOTICE copyright holder is generic ("AWS Network Visualizer contributors"); change if user wants a named holder.
- README Quick start and image size to be updated after Phase 1 produces a real image.
- Consider .gitignore at root (node_modules, dist, .env) before first commit; confirm app/.env.example handling.

## Next
Phase 1: read app/.env.example, app/index.html (CSP), app/src/utils/config.ts (read-only), then write docker/Dockerfile, nginx.conf, entrypoint; build image and report size (heads-up before each command; ask before docker build).

---
# Checkpoint 5 (2026-11-14)

## Done
- Root .gitignore added as guard-rail: secrets (.env*, keys, certs, .aws, ovpn), topology exports (snapshots, *-snapshot*.json, report html, pcap), build output, OS/editor files, references/. Verified with git check-ignore: .env, node_modules, dist, snapshot json, .DS_Store are ignored; .env.example, docs, README, LICENSE, NOTICE are not.
- references/ was committed as an embedded repo (gitlink 160000, no .gitmodules). User ran `git rm --cached` (option A). Now untracked + ignored; files stay on disk. Staged deletion pending commit.

## Git state (not yet committed)
- Staged: deletion of references/sample-network-resilience-agent.
- Modified: docs/checkpoint.md. Untracked: .gitignore, LICENSE, NOTICE, README.md.
- Tracked: app/ (252 files), docs/ (2 files). Commits are made by the user.
- To re-create references: git clone https://github.com/aws-samples/sample-network-resilience-agent.git references/sample-network-resilience-agent

## Next
Phase 1 reads (read-only): app/.env.example, app/index.html (CSP), app/src/utils/config.ts. Then write docker/Dockerfile, nginx.conf, entrypoint; ask before first docker build.

---
# Checkpoint 6 (2026-11-14) - Phase 1 files written (not yet built)

## Created (new)
- docker/Dockerfile (node:22-alpine build -> nginxinc/nginx-unprivileged:stable-alpine), docker/nginx.conf, docker/headers.conf, docker/40-runtime-config.sh (writes /tmp/nwv/config.js + csp.conf from env, whitelisted chars, read-only-fs friendly), docker/strip-csp-meta.mjs (build step, fails if meta missing).
- docker-compose.yml (read_only, tmpfs /tmp, cap_drop ALL, no-new-privileges, port 8080), root .dockerignore, app/public/config.js (dev default `window.__CONFIG__ = {}`).

## Edited in app/ (git diff: 7 files, +55/-14)
- src/utils/config.ts: precedence runtime window.__CONFIG__ > VITE_* > defaults; new bedrockEnabled (DEFAULT OFF) and ssoBackendUrl.
- src/vite-env.d.ts (RuntimeConfig/Window typing), src/api/sso-api.ts (uses config.ssoBackendUrl), index.html (<script src="/config.js">), src/App.tsx (lazy ChatPanel, shown only if bedrockEnabled), src/components/TopBar.tsx (chat button hidden if Bedrock off), .env.example (VITE_BEDROCK_ENABLED).

## Container env vars (all optional)
BEDROCK_ENABLED, BEDROCK_MODEL_ID, BEDROCK_GUARDRAIL_ID, BEDROCK_GUARDRAIL_VERSION, DEFAULT_REGION, DEFAULT_SCENARIO, APP_TITLE, SSO_BACKEND_URL, MAX_TOOL_ROUNDS, CSP_CONNECT_EXTRA (extra allowed origins).

## Corrections / notes
- Image size estimate corrected: nginx-unprivileged alpine ~50-60 MB on disk (~20 MB pull), not 25-30 MB. Measure after build.
- Bedrock off hides chat and avoids loading it at runtime; code still ships in dist (no image-size saving unless a build flag excludes it).
- Behavior change vs upstream: chat is hidden by default (needs BEDROCK_ENABLED=true or VITE_BEDROCK_ENABLED=true).

## Pending / risks
- Self-hosted fonts: add @fontsource/plus-jakarta-sans + @fontsource/jetbrains-mono, import weights in main.tsx, remove Google Fonts <link>s in index.html. Until then the CSP (font-src 'self') blocks Google Fonts inside the container.
- GuidedTour (driver.js) may reference data-tour="chat": check it still behaves when the button is hidden.
- Not yet verified: tsc/vitest/docker build. nginx-unprivileged envsubst not used (we generate /tmp/nwv/*.conf instead). Verify entrypoint script runs as non-root and that include /tmp/nwv/csp.conf exists at nginx start.
- APP_TITLE default still upstream "Network Resilience Agent".

## Next
1. Fonts step (npm install --package-lock-only for two @fontsource packages; edit main.tsx + index.html).
2. Check GuidedTour chat step.
3. First docker build (ask first), run container, check headers/CSP, report image size.

---
# Checkpoint 7 (2026-11-14) - tests + fonts written (not yet run)

## Tests added (all unrun so far; run via Docker test stage)
- app/src/utils/__tests__/config.test.ts: defaults without window, env fallback, runtime > env, empty runtime strings = unset, bedrockEnabled semantics (off by default, runtime false beats env true, exact "true" only), maxToolRounds (0 = unset, non-numeric ignored).
- app/tests/docker/runtime-config.test.mjs: runs docker/40-runtime-config.sh with sh: defaults, passthrough, script/newline injection stripped, digits-only rounds, CSP baseline (single add_header line, script-src 'self', frame-ancestors none), SSO origin only, port/localhost ok, non-http ignored, CSP_CONNECT_EXTRA valid/wildcard/junk, header-injection blocked.
- app/tests/docker/strip-csp-meta.test.mjs: strips meta from a copy of real index.html, fails loudly if meta missing, config.js loads before main.tsx.
- app/tests/docker/nginx-headers.test.mjs: every location with add_header re-includes headers.conf + csp.conf; config.js no-store; assets immutable.
- Placed under app/tests/ (.mjs) on purpose: tsconfig.app.json includes only src with types [vite/client], so node-using tests in src would break `tsc -b`.
- docker/40-runtime-config.sh: OUT now `${NWV_OUT:-/tmp/nwv}` (test hook, default unchanged). Manual smoke run with hostile input passed (injection neutralised, SSO origin only, rounds 7x -> 7).

## Fonts (self-hosted)
- Added deps @fontsource/plus-jakarta-sans ^5.3.0, @fontsource/jetbrains-mono ^5.3.0 (package-lock-only; no node_modules). main.tsx imports latin 400/500/600/700 + mono 400. index.html: removed Google Fonts links and Google allowances from the dev CSP meta.
- Assumes fontsource file names latin-<weight>.css exist (verify at first build).
- Leftover: stale comment in src/hooks/useExportImage.ts (~line 114) mentions fonts.googleapis; exported report HTML may still reference Google Fonts (not touched). Check html-to-image export still embeds fonts.

## Findings
- GuidedTour already filters steps whose target element is missing, so the chat step disappears when Bedrock is off. No change needed.

## Dockerfile now has stages: deps -> test (npm test, docker/ copied to /docker) / build (strip CSP meta, npm run build) -> nginx-unprivileged final (default target).
- Verify with: docker build -f docker/Dockerfile --target test .  (pulls node:22-alpine, npm ci inside container, no host install)
- Then: docker build -f docker/Dockerfile -t aws-network-visualizer .  and run via docker-compose.yml.

## Next (needs user approval before running)
1. docker build --target test (runs ~all upstream tests + ours in alpine).
2. Fix anything red; then production image build, run, curl /healthz /config.js and headers, report image size.

---
# Checkpoint 8 (2026-11-14) - pre-push readiness scan (read-only; nothing committed or pushed)

## Repo state
- Branch: main (only commit 2888d36 "Init"). Remote origin = https://github.com/Dino-s26/aws-network-visualizer.git, remote branch origin/main exists. git user.name/user.email are set.
- 27 files would be in the push (12 tracked changes incl. staged deletion of references/ gitlink, 16 untracked + docs). references/ is ignored (local only).

## Hygiene results: ALL CLEAR
- No files > 1 MB. No AWS key / private key / token patterns. No credential-like assignments. No local path or hostname leaks (<local-user-path>, <local-folder>). Only env file in the set is app/.env.example (intended). LICENSE, NOTICE, README.md, .gitignore, docker-compose.yml, .dockerignore present.

## Verification status: NOT YET DONE (blocks merge, not a WIP branch push)
- Never run: unit tests (upstream + ours), tsc -b, docker build, container smoke test (/healthz, /config.js, headers, CSP), image size.
- Unverified assumptions: fontsource latin-<weight>.css names; nginx-unprivileged runs 40-runtime-config.sh as non-root and /tmp/nwv exists at nginx start; busybox sh/tr/sed/grep behave like macOS in the script (the container test stage checks this).
- Command to verify (needs approval): docker build -f docker/Dockerfile --target test .

## Proposed branch + commits (user runs these; Claude does not commit/push without explicit approval)
- Branch: feat/phase1-docker-runtime-config
- Commit 1: housekeeping (.gitignore, LICENSE, NOTICE, README.md, docs/, staged references untrack)
- Commit 2: Docker + runtime config + optional Bedrock + self-hosted fonts + tests (everything else)
- Then: git push -u origin feat/phase1-docker-runtime-config (open as draft PR until test build and image smoke test pass)

## Known follow-ups
- README Quick start still says "planned"; update after the image builds and size is measured.
- Stale comment in src/hooks/useExportImage.ts (~line 114) mentions Google Fonts; exported report HTML may still reference Google Fonts.
- Consider CI (GitHub Actions) to run the Docker test stage and publish to GHCR.

---
# Checkpoint 9 (2026-11-14) - open question resolved

## Decision (user): "Flow of VPCs" = (a) static reachability, not Flow Logs and not wrapping Reachability Analyzer
- Scope stated by user: route tables, security groups, NACLs "and etz" (read as "etc" = other components on the path).
- Core hop checks for v1: VPC route tables (longest-prefix match), SG ingress/egress (incl. SG-to-SG refs, prefix lists), NACL in/out (stateless, ephemeral return ports), TGW attachments + associated RT + propagations/static routes + blackholes, VPC peering, VGW/VPN, DX gateway paths already fetched by upstream, ENIs/subnets for source and destination, return-path check.
- "etc" extras still to be chosen by user (multi-select asked): IGW/NAT internet path, VPC endpoints, Network Firewall, DX/VPN to on-prem. Anything not chosen stays out of v1 and is listed as a limitation in the UI.
- Where it lands: Phase 2 (2a data layer + TTL cache + IAM read perms, 2b pure engine/reachability + fixture tests, 2c UI panel highlighting the first failing hop).
- Status: Phase 2 not started. Phase 1 test build (docker build --target test) still awaiting user "go".

---
# Checkpoint 10 (2026-11-14) - reachability v1 scope expanded

## Decision (user): v1 also traces IGW/NAT, VPC endpoints, AWS Network Firewall
Full v1 scope: VPC RTs (LPM), SGs (incl. SG refs, prefix lists), NACLs, TGW (attachments, associated RT, propagations/static, blackholes), peering, VGW/VPN, DX paths, ENIs/subnets, return path, IGW (needs public IP/EIP + route), NAT gateway (egress only, in public subnet), gateway endpoints (S3/DynamoDB via prefix-list route), interface endpoints (ENI + SG), Network Firewall (route target vpce -> policy).
Still out of v1: GWLB, DNS resolution (incl. private DNS for endpoints), endpoint policy and IAM evaluation, domain/SNI/Suricata-complex firewall rules, on-prem beyond learned BGP.

## Verdict model (important for honesty)
PASS / FAIL / INCONCLUSIVE (with reason). A static trace cannot prove everything, e.g. firewall domain-list or complex Suricata rules, endpoint policies, DNS, on-prem. Those hops report INCONCLUSIVE instead of guessing.

## New data needed (2a) - extra read-only IAM
- ec2: DescribeInternetGateways, DescribeNatGateways, DescribeAddresses, DescribeVpcEndpoints, DescribeManagedPrefixLists, GetManagedPrefixListEntries (plus earlier list: subnets, NACLs, SGs and rules, ENIs, TGW RT associations).
- network-firewall: ListFirewalls, DescribeFirewall, DescribeFirewallPolicy, DescribeRuleGroup. New SDK client @aws-sdk/client-network-firewall (public AWS SDK; lazy-load).
- Update IAM policy docs: app/docs/SETUP.md and app/skills/resilience-report/reference/iam-policy.json equivalents (or our own policy file).

## Phase 2 split
- 2a data layer + TTL cache + IAM policy
- 2b engine core (LPM, route tables, SG, NACL, TGW, peering, VPN/VGW) + fixture tests
- 2c engine extensions (IGW/NAT, VPC endpoints, Network Firewall stateless + simple 5-tuple stateful, else INCONCLUSIVE) + tests
- 2d UI panel (source/destination/protocol/port picker, hop list, highlight first failing hop on canvas)
Sequencing: finish Phase 1 verification (docker test build, image build/smoke test) before starting 2a.

---
# Checkpoint 11 (2026-11-14) - Phase 1 unit tests verified

## Result: docker build -f docker/Dockerfile --target test .  =>  92/92 test files, 1367/1367 tests PASS (node:22-alpine)
- First run: 1366/1367. Single failure was a bug in OUR test helper (runtime-config.test.mjs): directive regex captured the closing `" always` for the last CSP directive (frame-ancestors). Fixed regex to `([^;"]*)`. Script itself was correct.
- All ~1,300 upstream tests still pass with our config.ts / App.tsx / TopBar.tsx / sso-api.ts changes.
- 40-runtime-config.sh verified under alpine busybox sh (tr, sed -E, grep -E behave as expected); injection tests pass.

## Not yet verified
- Production image build (npm run build incl. tsc -b + vite build, fontsource file names, strip-CSP step).
- Container smoke test: starts non-root, /tmp/nwv generated, include /tmp/nwv/csp.conf ok, GET /healthz, /config.js, headers + CSP present on /, /assets/*, /config.js; works with --read-only + tmpfs /tmp.
- Image size (estimate 50-60 MB on disk).
- Browser check: fonts load from 'self', no CSP violations in console, demo data loads, chat hidden when BEDROCK_ENABLED unset and shown when true.

## Next (needs approval: builds image, starts a container on localhost:8080)
1. docker build -f docker/Dockerfile -t aws-network-visualizer:dev .
2. docker run --rm --read-only --tmpfs /tmp -p 8080:8080 aws-network-visualizer:dev (via compose or direct), curl checks, docker images size, then stop container.

---
# Checkpoint 12 (2026-11-14) - Phase 1 production image built and smoke-tested

## Build: docker build -f docker/Dockerfile -t aws-network-visualizer:dev .  => OK on first try
- tsc -b + vite build pass. Fontsource names correct (latin 400/500/600/700 + mono 400, woff2 + woff both bundled). ChatPanel is a separate lazy chunk (283 kB, 83 kB gz) -> chat + Bedrock SDK only load when enabled. Main bundle 1.62 MB (434 kB gz) - upstream size, candidate for code-splitting later.
- Image size: 62.2 MB on disk (estimate was 50-60 MB). Base nginx-unprivileged:stable-alpine is nginx 1.30.6 on Alpine 3.x; app static files add roughly 3 MB.

## Smoke test: docker run --read-only --tmpfs /tmp --cap-drop ALL --no-new-privileges -p 127.0.0.1:8080:8080  => ALL PASS
- Runs as uid 101 (nginx), non-root. Health status: healthy. /healthz 200. SPA fallback 200.
- Headers on /: nosniff, X-Frame-Options DENY, Referrer-Policy no-referrer, Permissions-Policy, COOP/CORP same-origin, CSP (script-src 'self', connect-src 'self' https://*.amazonaws.com, font-src 'self' data:, frame-ancestors none), Cache-Control no-cache. Server version hidden.
- /config.js: served from /tmp/nwv, no-store, bedrockEnabled false. Assets: immutable, 1-year cache, CSP + nosniff present (location header re-includes work).
- Served index.html: CSP meta removed (0), /config.js script tag present (1).

## Known / accepted
- style-src keeps 'unsafe-inline' (React Flow/inline styles). No HSTS in nginx by design (terminate TLS upstream).
- woff duplicates (~91 kB) ship next to woff2; optional trim.
- docker-compose.yml not yet exercised (same settings as the manual run).
- Browser-level checks still open: fonts actually render from 'self', no CSP violations in console, demo data loads, chat button hidden with BEDROCK_ENABLED unset, shown when true.
- Container nwv-smoke left RUNNING on 127.0.0.1:8080 for the browser check. Stop with: docker rm -f nwv-smoke

## Next options
1. Browser check (user, or Claude in Chrome), then stop container.
2. Update README Quick start with the real command and measured size.
3. Commit/push branch feat/phase1-docker-runtime-config (hygiene scan was clean; re-scan new/changed files first).
4. Test docker compose up. 5. Start Phase 2a (reachability data layer).

---
# Checkpoint 13 (2026-11-14) - Phase 1 browser check done by user

- User opened http://127.0.0.1:8080 in a browser: demo data loaded (UI renders from the container). Claude in Chrome extension was not connected, so console/CSP-violation and chat-button checks were not independently confirmed by Claude; user reported only that demo data loaded.
- Asset-side checks (curl) all passed: 0 Google Font refs, 5 woff2 files 200 font/woff2, local @font-face for both families, lazy ChatPanel chunk served.
- Phase 1 status: image builds (62.2 MB), tests 1367/1367 pass, container runs non-root/read-only/healthy, headers + CSP verified, UI loads. Remaining Phase 1 polish: README quick start with real command/size, docker compose up test, GHCR CI, commit/push branch.
- Container nwv-smoke may still be running on 127.0.0.1:8080 (stop: docker rm -f nwv-smoke).

---
# Checkpoint 14 (2026-11-14) - change inventory (read-only scan; NO commit made, nothing staged)

## Repo history as found (user did git work outside this chat)
- Remote origin/main == local main == current branch feat/phase-1-dockerize == 5dfe0ce.
- Commits on main: 2888d36 Init -> 2df6275 PR #4 "Feat: Revamp aws-sample/sample-network-resilience-agent" (our Phase 1 work, 15 files incl. docker/*, tests, LICENSE, NOTICE, .gitignore, .dockerignore, compose) -> Dependabot PRs #1 happy-dom 20.10.1 -> 21.0.4, #2 vite 8.0.16 -> 8.3.8, #3 vitest/@vitest/mocker -> vitest ^4.1.12.
- Other branches: feat/revamp-original-aws-repo (remote, source of PR #4). Current branch has no upstream yet.
- No .github/ tracked: no CI, no tracked dependabot config.

## Uncommitted working-tree changes (tracked files only; no untracked files)
- README.md: rewritten (+40 -17): tested docker build/run quick start, 62 MB size, env var table, Bedrock off by default, roadmap w/ reachability scope, layout note on git-ignored references/.
- app/tests/docker/runtime-config.test.mjs: regex fix `([^;]*)` -> `([^;"]*)` (+1 -1).
- docs/checkpoint.md: +52 lines (checkpoints 9-13 and this one).
- Ignored/local only: references/ (upstream clone).
- docker/40-runtime-config.sh mode is 755 (executable bit OK).

## Findings / risks
1. COMMITTED test is the buggy version: main still has the `[^;]*` regex, so `npm test` has 1 failing test on main until the fix above is committed.
2. Dependabot bumps (vite minor, happy-dom MAJOR 20 -> 21, vitest) were merged AFTER our verified run (1367/1367 on old versions). Tests and production build must be re-run on the bumped lockfile.
3. Privacy nit: committed docs/checkpoint.md (line 157, Checkpoint 8) contains the user's local username and local folder name as literal strings (quoted from a leak-scan pattern). It is on the remote now. Fix going forward by rewording the line; removing it from history is optional and probably not worth a rewrite.
4. Secret scan of changed files AND of the committed tree: clean (no AWS keys, private keys, tokens, credential-like assignments). No files > 1 MB. No .env files besides app/.env.example.
5. docs/CLAUDE.md "Phases and status" is stale (still says Phase 1 NEXT / first reads pending).

## Pending decisions
- Re-run docker build --target test and the production build on the bumped dependencies (needs approval).
- Reword checkpoint line 157 (working tree only).
- User commits: README + test fix + docs on a branch; open PR. Add CI (GitHub Actions: test stage, image build, GHCR publish) later.
- Refresh CLAUDE.md status lines.

---
# Checkpoint 15 (2026-11-14) - bumped deps verified, local-name literals reworded (no commit made)

- Test stage on the Dependabot-bumped lockfile (vite ^8.3.8, vitest ^4.1.12, happy-dom ^21.0.4): 92/92 files, 1367/1367 tests PASS (in alpine). The happy-dom major bump caused no failures.
- Production build on bumped deps: OK. Image still 62.2 MB. Chunk hashes changed (ChatPanel chunk 283 kB, main 1.62 MB); no bundling regressions seen. Container not started this round (no smoke test on the new build).
- docs/checkpoint.md: replaced 2 literal occurrences of the user's local username path and local folder name with placeholders (working tree only). The old text still exists in committed history/main until the reworded file is committed.
- Uncommitted set (user to commit): README.md, app/tests/docker/runtime-config.test.mjs (regex fix: main currently has 1 failing test), docs/checkpoint.md.
- Still open: refresh stale status lines in docs/CLAUDE.md; CI (GitHub Actions); docker compose up test; optional container smoke test on the bumped build; Phase 2a.
