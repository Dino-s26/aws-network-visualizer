# Checkpoint log - AWS Network Visualizer

Newest entry first. To add one: insert it directly under this note, above the current newest entry, number it one higher, and end it with a line containing only `---`. The baseline (checkpoints 1-3: goal, rules, layout) is at the bottom.

Last updated: 2026-11-21

---

# Checkpoint 28 (2026-11-21) - fix and DX merged, build script, README status, first tag, checkpoint log reordered

## Repo state (GitHub)
- main = 6c16221 "README: clearer early-development notice, status and license badges, roadmap (#10)". Merged since checkpoint 27: PR #8 (edges-vanish fix), PR #6 (DX best-effort, VPC model, new default title, DX switch), PR #10 (README).
- Tag v0.0.1-dev.1 (annotated, message "First development snapshot") points at 6c16221, 0 commits since. The user updated the GitHub release. The release page itself (pre-release flag, notes) could not be read from the sandbox, so that is UNCONFIRMED: check it is marked pre-release. The tag does not contain the build script (PR not merged).
- PR #9 (branch feat/build-image-script, commit df76220) is open; not merged.

## Done in this stretch
- Edges-vanish fix: root cause and fix are in checkpoint 27; committed 5685466, merged as PR #8.
- docker/build-image.sh (+ app/tests/docker/build-image.test.mjs, README "Build script" section, CLAUDE.md command line): POSIX sh; engine docker/podman/nerdctl (--engine, $CONTAINER_ENGINE, else first found, with a "not responding, start it" message); test stage then production build, no image if tests fail; test image removed afterwards (no more unnamed test images); commit tag (-dirty when uncommitted); --run starts it hardened on 127.0.0.1 and waits for /healthz; --dry-run; values validated and passed as arguments, never eval; podman gets --format docker to keep the HEALTHCHECK. Verified: sh -n, dry-run tests for every engine, real run with Docker on macOS (tests, build, run, healthy). podman and nerdctl NOT executed (not installed).
- Flaky test: export-report-gateways failed once (1 of 1519) during a heavily loaded run (load average 22, Docker VM 4 CPUs, run took about 100 s instead of about 40 s). Passed on rerun and 3 of 3 in the sandbox. The error message was not captured, so the cause (load / timeout) is unproven. If it recurs: capture the failure block; consider a longer test timeout.
- README (PR #10): early-development notice ("not for production use yet"), Status and License badges (CI and Release badges deferred until a workflow and a release exist), image-tag note, intro rewording, roadmap rewrite.
- Versioning decision: counter-style pre-release tags (v0.0.1-dev.1, then -dev.2 ...); never move or delete a pushed tag; GitHub release marked pre-release; Release badge needs include_prereleases. Docker image tag from the git tag (without the v) is a later improvement (a --version option in the build script).
- CI discussion: levels A tests, B image + health check, C headless-browser smoke test, D publish to GHCR. Recommendation: A+B first (with the CI badge, in its own PR), C afterwards as a separate PR, D deferred. Traps: pushing .github/workflows may need workflow permission on the push credentials; pin actions to commit SHAs, permissions contents: read, no pull_request_target; a cached test layer does not re-run tests, so CI must force it.
- Checkpoint log reordered: newest entry on top, baseline (checkpoints 1-3) at the bottom, entries 23-28 added, convention recorded in docs/CLAUDE.md.

## Lessons / gotchas
- zsh does not word-split an unquoted variable: pass file lists explicitly.
- A cached Docker test layer does not re-run the tests: use --no-cache (or --no-cache-filter test) to force a run.
- A merge test can be silently invalid when a stale untracked file aborts the merge: check the merge result before trusting test numbers.
- GitHub release pages cannot be fetched from the sandbox unless the URL is given in the chat; the REST API is rate-limited for the sandbox address.

## Open items (carry forward)
1. User: open/merge PR #9 (build script). Then consider the next tag (v0.0.1-dev.2) and release notes.
2. Confirm the GitHub release for v0.0.1-dev.1 is a pre-release with notes (paste the release URL so it can be read).
3. GitHub Actions: A+B workflow with the CI badge (own PR), then the browser smoke test (own PR); decide on publishing to GHCR.
4. Housekeeping: delete unnamed/superseded images (list the IDs first); Dependabot alert #12; bind docker-compose.yml to 127.0.0.1; add the Release badge once the release exists.
5. Flaky-test follow-up (see above).
6. Pending features: SSO sign-in fix (portal address vs backend URL), banner step 2 (stop calling regions blocked by an organization policy), AWS fetchers for the VPC model, topology map, security posture rules, reachability.

---

# Checkpoint 27 (2026-11-21) - fixes merged, regression found from a screen recording, fix built and verified

## Repo state (GitHub)
- main = 3e08a53 (PR #7, squash of the three UI/UX fixes: error banner, resizable/auto-growing boxes, collapsible prefix labels). Verified: content identical to the tested branch; container test stage 98 files / 1435 tests pass.
- PR #6 (DX best-effort + VPC model + new default title + DX switch) is still OPEN. Not on main yet.
- Dependabot alert #12 (1 moderate) on the default branch: not looked at.
- GitHub Integration in claude.ai is read-only context; no write connector found. Branch/PR creation = user (git push prints the PR link) or local git via machine tools; gh CLI installed but not signed in.

## Image
- Rebuilt from main earlier: 333bace2a7f0 (served bundle contained all three fixes). Now superseded (see below). Older project images and test-stage images still on disk, not deleted.

## New bug (user screen recording, demo data)
- Symptom: expanding "Unattached resources" removes ALL connection lines, line labels and the connection cards inside the DX box until the zone is collapsed again.
- Method: ffmpeg contact sheets from the recording, then reproduced in headless Chromium (Playwright in the sandbox at /opt/pw-browsers works). Harness notes: set localStorage 'ra-tour-seen-v1' = '1' before load (the guided tour overlay blocks clicks), click "Use demo data", unlock via the "Unlock canvas" button. Edges counted via .react-flow__edge.
- A/B: 991ecd6 (before the fixes) keeps 7 edges; main loses all 7 (0 for 3+ s, with or without Live); bisect: only feat/resizable-containers (PR #7 part 2) causes it. Variants: without expandParent -> OK; with expandParent but ignoring library growth events -> OK. So it is the interaction.
- Root cause: instrumented build logged 150 change events in 2.5 s: each one re-measures all nodes and asks to grow aws-cloud to the same size; updateNodeDimensions replaced the node object even when the size was unchanged, so the library re-adopted and re-measured the nodes and asked again: an endless loop; edges never finish drawing. This regression came from my earlier box-growth patch.

## Fix
- app/src/store/topology-store.ts: updateNodeDimensions returns the same node when the size is already equal (within 0.5 px) via sameSize(). 10 lines.
- app/src/store/__tests__/update-node-dimensions.test.ts: 7 tests; 3 fail without the fix.
- Verified: sandbox real browser: 7 edges + 5 labels stay through expand/collapse (Live and not); also verified for the first time that unlocking shows 32 resize handles and dragging the DX gateway past the AWS box edge grows it (+290 x +108 px) with edges intact. Full suite sandbox 99 files / 1442 pass, tsc 0, eslint clean. On the user's machine: container test stage 99 / 1442 pass, production build clean.
- On the user's machine NOW: local branch feat/fix-edges-vanish-on-expand, 2 files changed, NOT committed, NOT pushed. New image 8119c59478ad; container nwv-new restarted on it (127.0.0.1:8080, healthy).

## Lessons
- The earlier box-growth patch had only logic tests; the rendering was never exercised in a browser. A headless-browser check now exists in the sandbox (not in the repo). Consider a small browser smoke test in the repo (demo -> expand zone -> edges stay; unlock -> drag grows box) so this class of regression is caught automatically.
- Applying a canvas-library event to the store must be idempotent.

## Open items
1. User decision: commit + push feat/fix-edges-vanish-on-expand (separate from PR #6), open PR.
2. Merge PR #6, rebuild, check the DX switch and title.
3. User visual check of the fix with the original recording steps (demo -> Live -> expand Unattached resources).
4. Housekeeping: delete superseded images (list IDs first); Dependabot alert #12; align repo compose file to bind 127.0.0.1; append checkpoints 23-27 to docs/checkpoint.md in one docs-only commit (kept out of the fix branch on purpose).
5. Still pending features: SSO sign-in fix (portal address vs backend URL), banner step 2 (stop calling regions blocked by an organization policy), AWS fetchers for the VPC model, topology map, posture rules, reachability.

---

# Checkpoint 26 (2026-11-21) - collapsible prefix lists on connection labels (built and tested in a sandbox clone; delivered as a patch)

## Problem (user screenshot; identifiers not recorded)
- A connection label listing every advertised prefix on its own line (about 30) rendered as a card roughly 300px tall that overlapped the Unattached resources box (covering part of its title) and sat under two peering labels; edges ran through it.

## Root cause (edges/CustomEdge.tsx)
- The "Allowed Prefixes" card is an EDGE LABEL (topology-builder only supplies the text), rendered as one div per label line with no height limit.
- The label collision-avoidance assumed every label is one short line (LABEL_HALF_H = 14, about 28px tall, LABEL_HALF_W = 80), so a 300px label "fit" where it actually covered nodes. It only avoids nodes, not other labels.

## User decision
- Collapse a long list to the first few prefixes with "+N more", click to expand in place (recommended option chosen).

## Changes
1. utils/label-lines.ts (new, pure): isPrefixLine, collapseLabelLines (collapses only when at least 2 lines would be hidden; shows the first 5 prefixes; title, id and status lines always kept, original indexes preserved), estimateLabelHalfHeight (never below 14; capped at the scroll height when expanded).
2. edges/CustomEdge.tsx: per-label expanded state; line mapper uses the collapsed view; "+N more" / "Show fewer" button (stops pointer events so it neither drags the label nor pans the canvas; aria-expanded and aria-label); expanded label scrolls inside a 260px box and sits above its neighbours (zIndex 1050); avoidance now uses the real visible height.
- Test added: utils/__tests__/label-lines.test.ts (14 tests).

## Verification (sandbox, upstream commit 6e109e5 base + patches 1 and 2)
- Full suite 94 files / 1405 tests pass; tsc -b exit 0; eslint clean (react-hooks rules included). Patch step3-collapsible-prefix-labels.patch applies cleanly on the base, on step 1, and on step 1+2; touches no file of the other patches.
- NOT verified: rendering in a real browser (no render harness exists for CustomEdge and none was built), the user's repo, container test stage, image build.

## Limits
- The avoidance still only avoids nodes, not other labels; collapsing removes most of the overlap, but two labels on one spot can still touch. A label-vs-label pass would need all label positions in one place: not done.
- Collapsing hides prefixes from a text selection until expanded.
- The label height estimate is approximate (11px per line); live-status detail rows are not counted.

## To apply (user, project root)
git apply --check step3-collapsible-prefix-labels.patch && git apply step3-collapsible-prefix-labels.patch
then: docker build -f docker/Dockerfile --target test . ; docker build -f docker/Dockerfile -t aws-network-visualizer:dev . ; restart the container.
Manual check: open an estate with a long Allowed Prefixes label: it should show the title, the id, 5 prefixes, "+N more" and the state line; click "+N more" to expand (scrollable, on top), "Show fewer" to collapse; the label should no longer cover the Unattached resources box.

## Open
- Banner work, step 2 (stop calling regions blocked by an organization policy), SSO sign-in fix, AWS fetchers: pending.
- Machine tools were unavailable, so nothing was written to docs/checkpoint.md; append this file by hand.

---

# Checkpoint 25 (2026-11-21) - resizable and auto-growing AWS / region boxes (built and tested in a sandbox clone; delivered as a patch)

## Problem (user screenshot; identifiers not recorded)
- The big AWS box and the region box kept the size the layout gave them: dragging nodes toward the edge did not enlarge the box, and there were no resize handles on them (upstream only had handles on DX location and customer site boxes).

## Findings
- The AWS box is a rectangle computed once by the layout engine from its children plus padding. Its children ARE real React Flow children (parentId 'aws-cloud'; regions and their nodes likewise), with no extent clamp, so the library's expandParent feature applies.
- The canvas only copied library dimension changes for customer sites and DX locations, and only when a handle was dragged (resizing flag), so parent-growth events (setAttributes) were ignored.
- The canvas is LOCKED by default (isLocked true, the red lock at the left); handles and dragging only work after unlocking.
- setNodeSizeOverride triggers a full re-layout in useTopology, which would undo user drags, so the new code does NOT use it.

## Changes
1. engine/layout-engine.ts: children of the AWS box and of each region get expandParent: true.
2. utils/container-fit.ts (new, pure): growContainersToFit() (grow-only, cascades region -> AWS box, climbs through non-container parents, cycle-safe) and shouldApplyDimensionChange() (AWS/region: manual resize or library growth; customer site / DX location: manual resize only, unchanged).
3. components/FlowCanvas.tsx: awsContainerIds set; onNodesChange uses shouldApplyDimensionChange; onNodeDragStop grows the dragged node's parent chain via growContainersToFit then updateNodeDimensions (only when unlocked).
4. components/nodes/AwsCloudNode.tsx and RegionNode.tsx: NodeResizer handles (min 320x220 and 240x160), visible when unlocked (regions also hidden for recommended/ghost nodes).
- Tests added: utils/__tests__/container-fit.test.ts, engine/__tests__/container-expand-parent.test.ts (multi-DXGW and VPN-only layouts: children flagged, none clamped).

## Verification (sandbox, upstream commit 6e109e5 base + step 1)
- Full suite 93 files / 1391 tests pass; tsc -b exit 0; eslint clean on changed files. Patch step2-resizable-containers.patch applies cleanly to the base commit and on top of step 1; shares no files with step 1.
- NOT verified: live "grow while dragging" in a real browser, the user's repo, container test stage, image build.

## Behavior to expect / limits
- Sizes and node moves persist only until the next re-layout (refresh, expanding a zone, etc.), same as node drags today. Persisting both would need saved positions: not done.
- The box only grows automatically; shrinking is manual (resize handles). Manual shrink below the contents is allowed and can clip; the next re-layout restores the computed size.
- Left/top overflow is handled by the library (it shifts the parent); the drop-time pass only handles right/bottom growth.

## To apply (user, project root, after step 1 or independently)
git apply --check step2-resizable-containers.patch && git apply step2-resizable-containers.patch
then: docker build -f docker/Dockerfile --target test . ; docker build -f docker/Dockerfile -t aws-network-visualizer:dev . ; restart the container.
Manual browser check: click the red lock to unlock; drag a node past the right/bottom edge of its box (the box should grow, and the AWS box with it); drag the box handles at its edges and corners; lock again.

## Open
- Banner work, step 2 (stop calling regions blocked by an organization policy) still pending.
- Machine tools were unavailable, so nothing was written to docs/checkpoint.md; append this file by hand.

---

# Checkpoint 24 (2026-11-21) - incomplete-data banner fix, step 1 (built and tested in a sandbox clone; delivered as a patch)

## Problem (from a user screenshot; identifiers not recorded)
- With a region blocked by an organization policy, the banner printed one near-identical paragraph per service call (about 15 for one region), told the user to "check your IAM policy grants ec2:Describe..." although an explicit deny in a service control policy overrides IAM, kept calling that region, and printed full ARNs: account IDs, role and session names, a person's work email, the organization and policy IDs.

## Changes (step 1)
1. app/src/utils/fetch-issues.ts: new IssueCause (org-policy | missing-permission | role-restriction | other) + classifyIssue(); guidanceFor() is now cause-aware: IAM advice only lists actions an IAM change can fix; separate wording for organization-policy and role restrictions; original wording kept for non-permission failures. Shared by banner and report.
2. app/src/utils/issue-display.ts (new): issueRegion, groupIssues, describeGroup, COMPACT_AT (5), maskIdentifiers (ARNs -> "your signed-in role" / "your user" / "an organization policy", plus account IDs, emails, org/policy IDs, access keys).
3. app/src/components/IncompleteDataBanner.tsx: one summary line per cause (count, regions, distinct actions); per-call rows hidden behind "Show all N technical details" above 5 issues; messages masked by default with a "Show account and role details" toggle; both reset when the topology is replaced; scroll limits so the banner cannot overflow the screen.
4. app/src/hooks/useExportReport.ts: report rows are masked too (the report is what gets shared).
- Tests added: utils/__tests__/issue-display.test.ts, components/__tests__/IncompleteDataBanner.causes.test.tsx, hooks/__tests__/useExportReport.mask.test.ts. Existing banner/report tests unchanged and still pass (retry/refresh/re-run wording stays banned).

## Verification
- Built against upstream commit 6e109e5 (the base of app/) in a sandbox: full suite 91 files / 1370 tests pass, tsc -b exit 0, eslint clean on changed files. Patch (step1-incomplete-data-banner.patch) applies cleanly to a clean copy of the base. NOT yet run in the user's repo, container test stage, image build or browser.

## To apply (user, from project root)
git apply --check step1-incomplete-data-banner.patch && git apply step1-incomplete-data-banner.patch
then: docker build -f docker/Dockerfile --target test .  and  docker build -f docker/Dockerfile -t aws-network-visualizer:dev .  and restart the container.

## Not done
- Step 2 (D): stop calling a region after it answers "blocked by organization policy", plus a saved "don't scan these regions" choice (needs a read of fetch-topology region sweep first).
- Same masking for other places that show raw AWS errors (e.g. status or error dialogs): not audited.
- Machine tools were unavailable, so nothing was written to docs/checkpoint.md; append this file by hand.

---

# Checkpoint 23 (2026-11-21) - SSO sign-in diagnosis, Docker kit, Colima / TLS-inspection test (Zscaler work skipped)

## SSO sign-in error (diagnosed, fix NOT yet built)
- Symptom: Identity Center tab said it could not reach the "SSO backend" at an address that was actually the user's Identity Center access portal address. Cause: portal address entered in the Backend URL field.
- Facts from code (app/src/components/SsoLoginFlow.tsx, app/src/api/sso-api.ts): two fields, Backend URL (a helper service the user must deploy: Lambda behind API Gateway, upstream "SSO backend"; not part of this app or the image) and Start URL (the portal address, awsapps.com/start or app.aws). The error text never explains what a backend is and does not detect a portal address in the wrong field. In our Docker image the CSP connect-src only allows *.amazonaws.com plus origins set via SSO_BACKEND_URL / CSP_CONNECT_EXTRA, so a backend typed into the form can be blocked by the browser and still reported as "couldn't reach".
- Proposed fix (7 points, awaiting "go"): (1) explainer at top of the tab, (2) clearer labels + help text, (3) detect a portal address in the backend field and offer one-click move, prefill region from it, (4) hide backend field when the deployment already set one and show which is in use, (5) distinct errors: blocked by CSP (name the setting), unreachable, backend error response, (6) no-backend path: aws configure export-credentials --profile <sso-profile> --format env (AWS CLI v2) pasted into Temporary Credentials, (7) tests for detection and message logic. Not in scope: bundling the helper as an optional container (separate design/security review).

## Docker kit artifact (delivered in chat)
- aws-network-visualizer-docker-kit.zip (Dockerfile with deps/test/build/final stages, nginx.conf, headers.conf, 40-runtime-config.sh with exec bit, strip-csp-meta.mjs, docker-compose.yml, .dockerignore) + BUILD-AND-RUN.md. Sandbox checks only: sh -n, smoke run with hostile input (sanitised, one add_header, dxEnabled false honoured). Image-level behaviour verified earlier on the user's machine.
- Difference to track: kit compose binds 127.0.0.1:8080; the repo's docker-compose.yml still publishes 8080:8080 on all interfaces. TODO: align repo compose to 127.0.0.1. Compose still untested. Kit omits app/ (the Dockerfile COPYs app/).
- Not chosen by the user: docker save export, separate one-page guide, GHCR publishing via GitHub Actions.

## Colima on a second device
- Build failed first on resolving docker/dockerfile:1 with x509 "unknown authority"; docker pull alpine:3 failed the same way. Mac itself reached the host fine (404 = TLS worked); the Colima VM did not. Certificate issuer on both Mac and VM was a corporate TLS-inspection proxy, so: interception confirmed, Mac trusts its CA, the Colima VM does not. User chose to skip the CA fix.
- Second error "/app: not found": the other device has the kit but not the repo; the Dockerfile needs app/. Options given: (A) run only: docker save on the build machine, docker load there (same CPU architecture needed; check with docker image inspect --format '{{.Architecture}}'), (B) clone the repo and build there (needs the CA step for npm ci, because the build container has its own trust list; would need an optional docker/certs/ drop-in, untested).
- Minor idea (not done): remove "# syntax=docker/dockerfile:1" from the Dockerfile to avoid one extra download per build.

## Machine tools
- Desktop Commander tools were unavailable in some turns of this session, so the usual git/docker live check and checkpoint write could not run. Last live-confirmed state is Checkpoint 22. This entry was saved as a file instead and must be appended by hand.

## Open items (carry forward)
1. SSO sign-in fix (7 points) - awaiting "go".
2. Slice 2a-2 part 2: AWS fetchers filling the VPC NetworkModel + mapper tests + extra read-only IAM policy; then 2b topology map, 2c security posture, 2d reachability.
3. Commit/PR for all uncommitted work on feat/dx-best-effort (DX best-effort + notice fix, title/column fixes, VPC model + demo data, docs). User runs git. A fresh clone elsewhere only gets what is pushed.
4. Housekeeping: 6 dangling test-stage images of this project (decision pending; consider --output type=cacheonly for test runs); align repo compose to 127.0.0.1; checks still to confirm: notice text with DX off, wider columns, Resilience Status card with zero DX gateways on a live account.
5. Optional artifacts not yet done: docker save export, GHCR publishing workflow (CI running the test stage).

---

# Checkpoint 22 (2026-11-15) - DX toggle confirmed; empty-state notice fixed; image rebuilt; old images removed

## User verification (screenshots, demo mode; no identifiers recorded)
- DX chip toggles both ways: "DX on" (green, tooltip "Direct Connect is on. Click to turn it off and refresh.") and "DX off" (grey, tooltip "Direct Connect is turned off, so no Direct Connect API calls are made..."). No bug; yesterday's "DX off" was the saved browser preference.
- Demo mode with DX off renders a sane VPN/VGW/VPC canvas plus the Unattached resources zone.
- Found: upstream EmptyStateBanner said "No Direct Connect resources found" even when DX was merely turned off (not checked). Fixed below.
- Session timeout banner (15 min inactivity) works; after expiry the app falls back to the demo scenario.

## Done
- app/src/api/dx-optional.ts: dxEmptyStateCopy(status, hasOtherResources) -> heading/body/hint for off ("Direct Connect is turned off", "was not checked") and unavailable ("Direct Connect was skipped", reason + fix); null for none/ok/unknown so upstream's text stays for a genuinely DX-less account.
- app/src/components/EmptyStateBanner.tsx uses it (heading, body, hint). Tests added in dx-optional.test.ts.
- Verified: container test stage 95 files / 1420 tests PASS; production build incl. tsc OK.
- New image aws-network-visualizer:dev = 23aade5235cd (62.2 MB). Container nwv-new restarted on it: 127.0.0.1:8080, healthy, served title "AWS Network Visualizer".
- Removed 4 superseded final images of this project (4e9197dea46d, 61e44d715419, 9a90e440aaa8, d6994a1600db), identified by build history containing 40-runtime-config.sh. First deletion pass matched nothing (faulty filter over all images); second pass over dangling images worked.

## Open
- 6 dangling test-stage builds of this project remain (about 430 MB each nominal, layers shared); listed, not deleted. Awaiting user decision. To stop accumulating them, run the test stage without exporting an image: docker build -f docker/Dockerfile --target test --output type=cacheonly .  (to verify, then update README/CLAUDE.md commands).
- Not yet visually confirmed by user on the new image: notice text with DX off, new title, wider VPC ID/CIDR columns.
- Resilience Status card with zero DX gateways on a live account: unchecked.
- All work since PR #5 still uncommitted on feat/dx-best-effort (user commits). Suggested split: (1) DX best-effort + notice fix, (2) title/columns quick fixes, (3) VPC model + demo data; or one commit.

## Next
- 2a-2 part 2: AWS fetchers filling NetworkModel (bounded pagination, logged() issue tracking), mapper tests with canned responses, extra read-only IAM policy documented. Then 2b topology map.

---

# Checkpoint 21 (2026-11-15) - session resumed; branch created; CLAUDE.md refreshed; 2a-2 part 1 (model + demo data)

## Repo state found at start of session
- main = 991ecd6 "Feat: Phase-1/Update dockerize (#5)" (PR #5 merged by user). DX best-effort work (slice 2a-1) was still uncommitted and sitting on main.
- Created branch feat/dx-best-effort (git switch -c; working changes carried over). Nothing committed, nothing pushed by Claude.
- Pre-commit scan of changed/new files: clean (no secrets, credential-like strings, local paths, account-ID patterns, files > 1 MB).

## Done this session
- docs/CLAUDE.md rewritten: VPC observability first, DX best-effort, commands, conventions (new code under app/src/vpc/, test placement, all-or-nothing edit scripts, never write real identifiers), current phases/status.
- Quick fixes: default title now "AWS Network Visualizer" (config.ts default, index.html <title>, 2 test assertions, README table); Unattached VPC table columns rebalanced (name 22, id 26, cidr 20, region 18, state 14 percent). Long IDs may still clip: the box has a fixed width.
- Slice 2a-2 part 1 (pure data/logic, no AWS calls):
  - app/src/vpc/model.ts: NetworkModel (VpcNet, Subnet, RouteTable/Route, SecurityGroup/SgRule, NetworkAcl/NaclEntry, NetworkInterface, InternetGateway, NatGateway, VpcEndpoint, PrefixList, Tgw, TgwAttachment, TgwRouteTable, PeeringConnection, FlowLog).
  - app/src/vpc/lookup.ts: indexModel (maps by id, subnetsByVpc, enisBySubnet, effective route table per subnet with main-table fallback, NACL per subnet), isPublicSubnet.
  - app/src/vpc/demo-data.ts: getDemoNetworkModel(), documentation-safe values only (account 111122223333, 10.x, 203.0.113.0/24, 198.51.100.0/24, IDs containing "demo"). Deliberate findings: SSH open to internet on public ENI; one-way peering route; blackhole routes (VPC RT and TGW RT); unused default VPC; flow logs only on prod; unused SG open on 3389.
  - app/src/vpc/__tests__/model.test.ts: safety, internal consistency, lookup helpers, and the deliberate findings.

## Verified
- Container test stage: 95 files / 1416 tests PASS (+16). Production build incl. tsc: OK. New image aws-network-visualizer:dev = d6994a1600db, 62.2 MB.
- Container nwv-new (started this session on 127.0.0.1:8080, healthy) still runs the PREVIOUS image 4e9197dea46d (title/column fixes not visible there until restarted on the new image).

## Open
- DX chip click test (user): what does the chip read before/after one click?
- Restart nwv-new on the new image and delete superseded images (4e9197dea46d after restart; older 61e44d71..., 9a90e440...; 6+ dangling in total). Awaiting user decision.
- Resilience Status card with zero DX gateways; demo mode with DX off: not checked.
- All work since PR #5 uncommitted on feat/dx-best-effort (user commits).

## Next
- 2a-2 part 2: fetchers that fill NetworkModel from AWS (DescribeSubnets, RouteTables, SecurityGroups, NetworkAcls, NetworkInterfaces, InternetGateways, NatGateways, VpcEndpoints, ManagedPrefixLists + entries, FlowLogs, TGW attachments/route tables/associations, peering), using upstream's bounded pagination helper and logged() issue tracking; mapper unit tests with canned responses; extra read-only IAM policy documented.
- Then 2b topology map (wire demo model into a new VPC view).

---

# Checkpoint 20 (2026-11-14) - new image running; first live-account look

## State
- User started container nwv-new from the new image (aws-network-visualizer:dev, 4e9197dea46d, 62.2 MB) on 127.0.0.1:8080: running, healthy. Served /config.js has dxEnabled true, bedrockEnabled false; no DX_ENABLED / BEDROCK_ENABLED env set. Stop with: docker rm -f nwv-new
- Nothing committed by Claude. All work since PR #4 is still uncommitted (README, tests, DX best-effort backend + UI, checkpoints, CLAUDE.md edits).
- Screenshot from the user's browser contained a real account ID and real VPC IDs/names: NOT recorded here. Reminder: keep such screenshots out of public places (issues, PRs).

## Observations from the live-account screenshot (no identifiers)
- Live scan works end to end with Access Key login: VPCs found across 18 regions (region sweep confirmed, DX not needed).
- Every VPC is a default VPC (172.31.0.0/16), one per region, and all land in a single "Unattached resources" table, because upstream's canvas is built around DX paths. Tabs (Live / Utilization / Recommendation), the Resilience Status card and the minimap are DX-shaped. Confirms the need for the VPC topology map (2b).
- Chip showed "DX off" although the deployment serves dxEnabled true. Expected "DX: none found" if DX were on. Most likely the browser-saved preference (nwv-dx-enabled = 0, e.g. from an earlier click). TEST PENDING: click the chip once, expect refresh and "DX: none found" or "DX on". If it stays "DX off", investigate as a bug (check dx-preference / describeDx / dxStatus path).
- CIDR and VPC ID columns are truncated in the Unattached table (UI fix). Default title still "Network Resilience Agent" (change default to neutral).
- New posture rule candidate for 2c: unused default VPC present in every region (CIS suggests removing unused default VPCs); plus default SG with rules.

## Open items
1. Click test on the DX chip (user) and report what it shows.
2. Expand Resilience Status card with zero DX gateways: what does it show? (is the score meaningful or misleading?)
3. Demo mode with DX off: does the VPC/TGW-only canvas look sane?
4. Image housekeeping: two older project images (61e44d71..., 9a90e440..., ~62 MB each) and 6 dangling images in total remain; not deleted, awaiting user decision. Dangling images may belong to other projects; do not bulk prune without listing.
5. docs/CLAUDE.md "Phases and status" lines are stale; refresh with next checkpoint.
6. Commit + PR (user runs git). Consider CI (GitHub Actions: test stage, image build, GHCR).
7. Optional: make Cloud WAN fetch failures optional like DX if VPC-only users see banner noise.

## Next (proposed)
Slice 2a-2: normalized VPC NetworkModel + fetchers + synthetic dataset (+ quick fixes: neutral default title, column widths), then 2b topology map, 2c security posture, 2d reachability.

---

# Checkpoint 19 (2026-11-14) - DX UI step done; new image built; previous image deleted

## Verified
- Container test stage: 94 files / 1400 tests PASS (+14 new). Production build incl. tsc -b: OK. Nothing committed or staged by Claude.
- New image aws-network-visualizer:dev = sha256:4e9197dea46d..., 62.2 MB. Previous :dev image sha256:71df5b0b2a13... DELETED at user request (docker rmi of that single ID).
- Runtime smoke test and browser/UI check NOT yet done on this image.

## Implemented (UI step of slice 2a-1)
- src/utils/dx-preference.ts: localStorage preference (key nwv-dx-enabled) + in-memory fallback + useSyncExternalStore hook. Effective value = config.dxEnabled && preference != off: deployment DX_ENABLED=false is a hard lock the user cannot override.
- src/components/DxToggle.tsx + TopBar: always-visible chip/switch (on / off / none found / skipped), tooltip with reason, aria-label, disabled when locked; toggling refreshes the topology (note: refresh clears user-drawn edits, as upstream refresh does).
- src/api/dx-optional.ts additions: isDxActive, stripDxData (mutating), withoutDx (copy), describeDx (chip text/tone). fetch-topology strips partial DX data when dxStatus is unavailable.
- useTopology.ts: passes { dxEnabled: getDxEnabled() } to the fetch; demo/mock data is passed through withoutDx when DX is off.
- README: DX best-effort paragraph + DX_ENABLED row. Tests: dx-optional (+isDxActive/strip/withoutDx/describeDx), dx-preference (default, saved off, persist+notify, locked by deployment, broken storage).

## Open / to check manually
- Browser: chip renders and toggles; demo mode with DX off still renders a sane VPC/TGW canvas (upstream supports non-DX estates but not visually confirmed); ResiliencyScoreCard behavior with zero DX gateways.
- Image housekeeping: two older project images still present (sha256:61e44d71..., sha256:9a90e440..., ~62 MB each) plus 6 dangling images in total (rest likely test-stage builds). Not deleted; awaiting user decision.
- Still uncommitted: all work since PR #4 (README, tests, DX best-effort backend + UI, checkpoints).

## Next
- User check of new image in browser (or Claude smoke test via docker run); then commit/PR.
- Then slice 2a-2: normalized VPC NetworkModel + fetchers + synthetic dataset, then 2b topology map.

---

# Checkpoint 18 (2026-11-14) - Slice 2a-1 (backend/config part) done: DX best-effort, no UI yet

## Verified
- Container test stage: 93 files / 1386 tests PASS (was 1367; +19 new). Production build incl. tsc -b: OK. Nothing committed or staged by Claude. Container runtime smoke test not re-run on this build.

## Implemented
- NEW app/src/api/dx-optional.ts: classifyDxError (permission | credentials | unreachable | error), DxProbe, loggedDx (thunk-based, never calls when DX off or already denied, never writes FetchIssue), dxSkipped, dxStatusFrom -> DxStatus {state ok|off|none|unavailable, reason?, detail?}.
- NEW app/src/api/__tests__/dx-optional.test.ts (classification, skip/stop-after-denial, unreachable region, status rules).
- app/src/api/fetch-topology.ts: fetchAllTopologyData(creds, options {dxEnabled?}) defaults to config.dxEnabled; all DX calls (DxGateways, per-region Connections/VIFs/Lags/Locations, DxGwAssoc, DxGwAttachmentRegions) go through loggedDx; BGP metrics and Health DX events skipped when DX skipped or no DX resources; topology.dxStatus set before fetchIssues attach. fetchIssues/banner untouched: DX never raises the "incomplete data" banner.
- app/src/types/topology.ts: TopologyData.dxStatus?: DxStatus + DxStatus type.
- Config: config.dxEnabled (runtime dxEnabled > VITE_DX_ENABLED > default true; only exact "false" disables). docker/40-runtime-config.sh writes dxEnabled (DX_ENABLED env, default true). Updated vite-env.d.ts, .env.example, docker-compose.yml comment, README env table, runtime-config + config tests.
- Plan correction recorded: upstream already sweeps all enabled regions (DescribeRegions), so region discovery does not depend on DX; a region picker is optional scope-limiting only. STS-based credentials check dropped: DX failures no longer enter fetchIssues, so a DX-only denial cannot trigger the "invalid credentials" abort.

## Known limits / follow-ups
- UI not wired yet: no DX on/off toggle, no status chip, DX-only panels (ResiliencyScoreCard, report DX sections) still render from whatever data exists. Needed: hide DX-only UI when dxStatus.state is not ok; consider a pure withoutDx(topology) to drop partial DX data when state is unavailable (a partly-denied DX could otherwise show a misleading score; upstream banner comment warns that empty can read as pass).
- Cloud WAN (networkmanager) failures still raise normal "failed" issues; could be made optional the same way if VPC-only users hit noise.
- Demo/mock scenarios are DX-centric and have no dxStatus (treated as ok).
- Uncommitted: all of the above plus earlier README/test-fix/docs changes.

## Next: slice 2a-1 UI step
1. Small localStorage-backed preference (src/utils/dx-preference.ts + hook) for the DX toggle; loadTopology passes { dxEnabled }.
2. Toggle + DX status chip in the top bar (tooltip with reason/detail); toggling refreshes.
3. Gate DX-only UI on dxStatus; add withoutDx where needed. Tests for the pure parts.
Then 2a-2: normalized VPC NetworkModel + fetchers + synthetic dataset.

---

# Checkpoint 17 (2026-11-14) - DX best-effort: enabled by default, skipped quietly when unavailable

## User context
DX stays ON by default. If DX resources are unavailable (none in account, missing permission, API error), skip DX and show only VPC resources. Toggle still lets the user turn DX fully off. Landing view = VPC view; DX view appears only when DX data exists.

## Upstream behavior found (read-only)
- api/fetch-topology.ts: every fetch goes through logged(name, promise, issues): catches errors, pushes FetchIssue {label, kind 'failed'|'truncated', message}, returns []. One failed service does not blank the topology. Issues ride out on TopologyData.fetchIssues and drive IncompleteDataBanner (persistent warning that says a permissions gap is the usual cause; fetch-issues.ts extracts the denied action).
- So DX failure already degrades gracefully, BUT it shows a "failed to load / incomplete data" banner, which is the wrong message for an expected "no DX here".
- Abort heuristic (~line 322): throws "Invalid AWS credentials" only if an issue message matches an auth pattern (includes AccessDenied) AND connections, DX gateways and VPCs are all empty. A DX-only denial with VPCs present does not abort; an account with no VPCs in scanned regions + DX denied would get a misleading credentials error. Better signal: STS GetCallerIdentity failure (callerAccountId === '').
- Regions are discovered from DXGW associations + Cloud WAN + DX attachment regions. With DX empty/skipped there is no region source -> need the region picker.
- DX-only extras that must also be skipped: CloudWatch BGP metrics, AWS Health DX maintenance events, DX route tables/panels, resilience engine, score card, report export.

## Slice 2a-1 (proposed first implementation step, small)
1. Config: DX_ENABLED (runtime + VITE_DX_ENABLED), default true; UI toggle in settings/top bar; false = zero DX API calls and no DX IAM permissions needed.
2. New FetchIssueKind 'skipped' (types/topology.ts) with reason: none-found | no-permission | unsupported | error. loggedOptional() wrapper for DX calls; fetch-issues.ts and IncompleteDataBanner treat 'skipped' as informational (not counted as failed, no scary banner); small "Direct Connect: skipped (reason)" status chip.
3. Replace the credentials-abort heuristic with an STS-based check; VPC data presence no longer decides it.
4. Skip DX phases (Phase 1 DX gateways, 3b attachment regions, BGP metrics, Health events) when disabled or when DX returns nothing/denied; keep Cloud WAN behavior unchanged unless it proves DX-coupled.
5. Region source when DX gives none: user region picker (default = credential region, option all enabled regions).
6. Tests: unit tests for kind classification (AccessDenied vs empty vs other), DX_ENABLED off => no DX client calls, STS-based abort. Reuse upstream fetch tests' mocking style (src/api/__tests__).
Then 2a-2: normalized VPC NetworkModel + fetchers + synthetic dataset.

---

# Checkpoint 16 (2026-11-14) - PIVOT: VPC observability first, Direct Connect becomes optional

## User decisions
- Focus shifts from DX resilience to VPC observability. Deliver first: (1) topology map (VPCs, subnets/AZs, TGW, peering, endpoints), (2) reachability trace A->B, (3) security posture (exposed SGs/NACLs, public paths). VPC Flow Logs traffic analysis NOT in first scope.
- DX: add a toggle so DX can be turned off. Assumption to confirm: separate "Direct Connect" view, shown only when DX is enabled; default OFF (VPC-first); runtime flag DX_ENABLED + UI switch. DX off = no DX API calls, no DX permissions needed (least privilege).

## Design principles
- New code in new modules (src/vpc/*: model, api, engine, components); minimal edits to upstream files so upstream merges stay easy. No DX code deleted yet.
- Normalized NetworkModel (accounts, regions, VPCs incl. secondary/IPv6 CIDRs, subnets+AZ, route tables+targets, IGW/NAT/EIP, ENIs, SGs, NACLs, endpoints, prefix lists, TGW+attachments+RT assoc/propagation, peering, VPN/VGW, flow-log config, firewall summary). Pure engines (posture rules, reachability) over this model, tested with fixtures.
- Topology map: Region > VPC > AZ > Subnet containers, collapsed by default, expand per VPC, detail side panel. Own deterministic layout (no new library); upstream DX layout engine not reused.
- Region scope: DX no longer reveals regions, so add a region picker (default = credential region, option "all enabled regions"), TTL cache to limit API calls. Multi-account: reuse upstream spoke-role enrichment idea.
- Demo mode needs a synthetic VPC dataset (also used as test fixture): ~3 VPCs, subnets, TGW, peering, endpoints, deliberately risky SG/NACL.

## Security posture rule ideas (pure rules, severity + link to node)
- SG open to 0.0.0.0/0 or ::/0 on all ports or sensitive ports (22, 3389, DB ports), default SG with rules, unused SGs.
- NACL allow-all, shadowed/ordered-wrongly rules, ephemeral-port gaps.
- Internet-reachable ENIs (public IP/EIP + IGW route + open SG + permissive NACL); public subnets with no restriction.
- Blackhole routes, missing return routes (peering/TGW), overlapping CIDRs across peers, unassociated route tables, TGW attachments without propagation.
- VPC Flow Logs not enabled (DescribeFlowLogs; config check only).

## Revised phases
- 2a data layer + model + TTL cache + region picker + DX_ENABLED plumbing + synthetic dataset
- 2b topology map v1 (nodes, layout, expand/collapse, detail panel)
- 2c security posture engine + findings panel + tests
- 2d reachability core (RT, SG, NACL, TGW, peering, VPN) + panel; 2e IGW/NAT, endpoints, Network Firewall (INCONCLUSIVE when not statically evaluable)
- 3 UI/UX settings, reduced motion, persistent cache (off by default); 4 optional Flow Logs analysis, SQLite history
- Also: neutral default title, README repositioned as "VPC observability, optional Direct Connect view", update CLAUDE.md and README roadmap after plan approval.

## Risks
- Scale (hundreds of VPCs / thousands of SGs): collapse-by-default, onlyRenderVisibleElements, paging, cache. Cross-account SG/NACL access needs per-account read roles. Reachability remains the most complex part.
- Status: plan awaiting user approval; nothing implemented for the pivot yet.

---

# Checkpoint 15 (2026-11-14) - bumped deps verified, local-name literals reworded (no commit made)

- Test stage on the Dependabot-bumped lockfile (vite ^8.3.8, vitest ^4.1.12, happy-dom ^21.0.4): 92/92 files, 1367/1367 tests PASS (in alpine). The happy-dom major bump caused no failures.
- Production build on bumped deps: OK. Image still 62.2 MB. Chunk hashes changed (ChatPanel chunk 283 kB, main 1.62 MB); no bundling regressions seen. Container not started this round (no smoke test on the new build).
- docs/checkpoint.md: replaced 2 literal occurrences of the user's local username path and local folder name with placeholders (working tree only). The old text still exists in committed history/main until the reworded file is committed.
- Uncommitted set (user to commit): README.md, app/tests/docker/runtime-config.test.mjs (regex fix: main currently has 1 failing test), docs/checkpoint.md.
- Still open: refresh stale status lines in docs/CLAUDE.md; CI (GitHub Actions); docker compose up test; optional container smoke test on the bumped build; Phase 2a.

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

# Checkpoint 13 (2026-11-14) - Phase 1 browser check done by user

- User opened http://127.0.0.1:8080 in a browser: demo data loaded (UI renders from the container). Claude in Chrome extension was not connected, so console/CSP-violation and chat-button checks were not independently confirmed by Claude; user reported only that demo data loaded.
- Asset-side checks (curl) all passed: 0 Google Font refs, 5 woff2 files 200 font/woff2, local @font-face for both families, lazy ChatPanel chunk served.
- Phase 1 status: image builds (62.2 MB), tests 1367/1367 pass, container runs non-root/read-only/healthy, headers + CSP verified, UI loads. Remaining Phase 1 polish: README quick start with real command/size, docker compose up test, GHCR CI, commit/push branch.
- Container nwv-smoke may still be running on 127.0.0.1:8080 (stop: docker rm -f nwv-smoke).

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

# Checkpoint 9 (2026-11-14) - open question resolved

## Decision (user): "Flow of VPCs" = (a) static reachability, not Flow Logs and not wrapping Reachability Analyzer
- Scope stated by user: route tables, security groups, NACLs "and etz" (read as "etc" = other components on the path).
- Core hop checks for v1: VPC route tables (longest-prefix match), SG ingress/egress (incl. SG-to-SG refs, prefix lists), NACL in/out (stateless, ephemeral return ports), TGW attachments + associated RT + propagations/static routes + blackholes, VPC peering, VGW/VPN, DX gateway paths already fetched by upstream, ENIs/subnets for source and destination, return-path check.
- "etc" extras still to be chosen by user (multi-select asked): IGW/NAT internet path, VPC endpoints, Network Firewall, DX/VPN to on-prem. Anything not chosen stays out of v1 and is listed as a limitation in the UI.
- Where it lands: Phase 2 (2a data layer + TTL cache + IAM read perms, 2b pure engine/reachability + fixture tests, 2c UI panel highlighting the first failing hop).
- Status: Phase 2 not started. Phase 1 test build (docker build --target test) still awaiting user "go".

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

# Checkpoints 1-3 (baseline, 2026-11-14) - AWS Network Visualizer (fork of aws-samples/sample-network-resilience-agent)

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
