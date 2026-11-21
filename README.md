# AWS Network Visualizer

[![Status](https://img.shields.io/badge/Status-Early_development-orange?style=for-the-badge)](#roadmap)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)](LICENSE)

Interactive AWS network topology viewer: discover your VPC, Transit Gateway, VPN and (optionally) Direct Connect layout, see resilience gaps, and (planned) trace whether traffic can flow from A to B.

> **Status: early development, not for production use yet.**
> Features, interfaces and the Docker image may change without notice, and there are no versioned releases yet. Forked from [aws-samples/sample-network-resilience-agent](https://github.com/aws-samples/sample-network-resilience-agent).
>
> **Works today:** demo scenarios, a live read-only view of your account, the Direct Connect switch, an error banner that groups failures by cause, resizable boxes and collapsible long labels.
>
> **Planned, not built yet:** the VPC topology map, security-posture checks and reachability tracing (see the [roadmap](#roadmap)).
>
> **Before you try it on a real account:** use short-lived, read-only credentials and read the [Security model](#security-model).

## Quick start (Docker)
```
docker build -f docker/Dockerfile -t aws-network-visualizer .
docker run --rm -p 127.0.0.1:8080:8080 aws-network-visualizer
```
Open http://localhost:8080 and choose **Use demo data** or **Connect AWS**. The image is about 62 MB, runs as a non-root user, and needs no configuration.

> **About image tags:** there are no releases yet. `aws-network-visualizer` (or `:dev`) is simply what you built last, not a version. Build from a known commit if you need to reproduce a result.

Hardened run (read-only filesystem, no extra privileges):
```
docker run --rm --read-only --tmpfs /tmp --cap-drop ALL \
  --security-opt no-new-privileges:true -p 127.0.0.1:8080:8080 aws-network-visualizer
```

## Configuration (all optional, set with `-e NAME=value`)
| Variable | Default | Purpose |
|---|---|---|
| `BEDROCK_ENABLED` | `false` | Show the Amazon Bedrock chat assistant (exact value `true`) |
| `DX_ENABLED` | `true` | Direct Connect view. Skipped automatically if DX is unavailable; set `false` to never call DX APIs |
| `BEDROCK_MODEL_ID` | `global.anthropic.claude-opus-5` | Bedrock model for chat |
| `BEDROCK_GUARDRAIL_ID`, `BEDROCK_GUARDRAIL_VERSION` | empty, `DRAFT` | Bedrock Guardrail (recommended when chat is on) |
| `DEFAULT_REGION` | `us-east-1` | Region used for demo mode and as fallback |
| `DEFAULT_SCENARIO` | `noResiliency` | Demo scenario: `noResiliency`, `devTest`, `high`, `maximum`, `crossAccount` |
| `APP_TITLE` | `AWS Network Visualizer` | Title in the top bar |
| `SSO_BACKEND_URL` | empty | Optional SSO backend (see `app/docs/SETUP.md`) |
| `MAX_TOOL_ROUNDS` | `5` | Max chat tool-use rounds per turn |
| `CSP_CONNECT_EXTRA` | empty | Extra allowed origins for browser requests, space separated |

Values are checked and restricted to safe characters when the container starts. The SSO backend origin is added to the Content-Security-Policy automatically.

**Direct Connect is best-effort.** It is on by default. If the account has no Direct Connect, or the credentials lack permission, it is skipped quietly and only VPC resources are shown. The DX switch in the top bar turns it off completely (no Direct Connect API calls, no DX permissions needed). `DX_ENABLED=false` disables it for the whole deployment, and users cannot turn it back on.

**Bedrock chat is off by default.** Turning it on needs Bedrock model access in your AWS account. Use a Bedrock Guardrail for anything beyond local testing.

## Run from source
Requires Node.js 22 or newer. From `app/`:
```
npm ci
npm run dev       # dev server on :5173 with demo data
npm run build     # static bundle in dist/
npm test          # unit tests
```
To run the full test suite inside a container instead (no local install):
```
docker build -f docker/Dockerfile --target test .
```

## Security model
- The app is a static page. AWS API calls are made from your browser using credentials you enter.
- Credentials are not stored. Use short-lived credentials (SSO or temporary keys) and a read-only IAM role.
- The container serves strict security headers, including a Content-Security-Policy. Add HSTS at your TLS terminator.
- Do not share exported topology snapshots without using the sanitized export.

## Roadmap
Item 1 is done; the rest is planned and may change.
1. **Done:** Docker image, runtime configuration, security headers, optional Bedrock chat, a Direct Connect switch that skips Direct Connect quietly when unavailable, clearer error reporting, resizable boxes
2. **VPC topology map:** Region > VPC > AZ > subnet, with a detail panel for route tables, security groups and endpoints
3. **Security posture checks:** open security groups and NACLs, internet-reachable interfaces, blackhole routes, overlapping CIDRs, unused default VPCs, Flow Logs not enabled
4. **Static reachability trace (A to B):** route tables, security groups, NACLs, Transit Gateway, peering, VPN, Direct Connect, internet and NAT gateways, VPC endpoints and Network Firewall. Anything that cannot be evaluated statically is reported as inconclusive, not guessed
5. UI/UX settings, reduced motion, optional local cache and restore-last-view
6. Optional: scan history, VPC Flow Logs analysis

## Project layout
```
app/                web application (React, TypeScript, Vite)
docker/             Dockerfile, nginx config, runtime config script
docker-compose.yml  compose equivalent of the run command
docs/               checkpoint and project notes
references/         optional, git-ignored: clone upstream here to compare
```

## Credits
Based on the work of the authors of aws-samples/sample-network-resilience-agent (MIT-0). See `NOTICE`.

## License
Apache License 2.0. See `LICENSE`.

## Contributing
Issues and pull requests are welcome. Keep changes small, tested and dependency-light.
