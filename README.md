# AWS Network Visualizer

Interactive AWS network topology viewer: discover your Direct Connect, Transit Gateway and VPC layout, see resilience gaps, and (planned) trace whether traffic can flow from A to B.

> **Status: early work in progress.** Forked from [aws-samples/sample-network-resilience-agent](https://github.com/aws-samples/sample-network-resilience-agent). The Docker image works today. Reachability tracing is planned, not released yet.

## Quick start (Docker)
```
docker build -f docker/Dockerfile -t aws-network-visualizer .
docker run --rm -p 127.0.0.1:8080:8080 aws-network-visualizer
```
Open http://localhost:8080 and choose **Use demo data** or **Connect AWS**. The image is about 62 MB, runs as a non-root user, and needs no configuration.

Hardened run (read-only filesystem, no extra privileges):
```
docker run --rm --read-only --tmpfs /tmp --cap-drop ALL \
  --security-opt no-new-privileges:true -p 127.0.0.1:8080:8080 aws-network-visualizer
```

## Build script
`docker/build-image.sh` does the build for you: it runs the unit tests in a container, builds the image, and with `--run` starts it hardened on `127.0.0.1:8080` and waits until it answers. It works with Docker, Podman or nerdctl (for example Colima), picked with `--engine` or `$CONTAINER_ENGINE`, otherwise the first one found.
```
docker/build-image.sh                 # tests, then build
docker/build-image.sh --run           # ... then start it
docker/build-image.sh --skip-tests --run --name nwv --port 8080
docker/build-image.sh --dry-run       # print the commands, run nothing
```
Other options: `--tag NAME:TAG`, `--no-cache`, `--platform linux/amd64`. A second tag with the git commit is added automatically. `--run` replaces a container with the same `--name`.

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
1. Docker image, runtime configuration, nginx security headers, optional Bedrock (done)
2. Static reachability trace (A to B): route tables, security groups, NACLs, Transit Gateway, peering, VPN, Direct Connect, internet and NAT gateways, VPC endpoints and Network Firewall. Anything that cannot be evaluated statically is reported as inconclusive, not guessed.
3. UI/UX settings, reduced motion, optional local cache and restore-last-view
4. Optional: scan history, VPC Flow Logs analysis

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
