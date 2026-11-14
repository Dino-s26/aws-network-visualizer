# AWS Network Visualizer

Interactive AWS network topology viewer: discover your Direct Connect, Transit Gateway and VPC layout, see resilience gaps, and (planned) trace whether traffic can flow from A to B.

> **Status: early work in progress.** Forked from [aws-samples/sample-network-resilience-agent](https://github.com/aws-samples/sample-network-resilience-agent). The Docker image and reachability features below are planned, not released yet.

## Goals
- **Minimal setup:** one `docker run`, no npm, no required config.
- **Small image:** static files served by nginx, nothing else.
- **Optional AI:** Amazon Bedrock chat is off unless you configure it.
- **Flow checks (planned):** static reachability across VPCs, subnets, route tables, NACLs, security groups and Transit Gateways.
- **Simple UX:** low friction, customizable, minimal animation.

## Quick start (planned)
```
docker run --rm -p 8080:8080 <image>
```
Then open http://localhost:8080 and choose **Use demo data** or **Connect AWS**.

## Run from source
Requires Node.js 22 or newer. From `app/`:
```
npm ci
npm run dev       # dev server on :5173 with demo data
npm run build     # static bundle in dist/
npm test          # unit tests
```

## Security model
- The app is a static page. AWS API calls are made from your browser using credentials you enter.
- Credentials are not stored. Use short-lived credentials (SSO or temporary keys) and a read-only IAM role.
- Do not share exported topology snapshots without using the sanitized export.

## Roadmap
1. Docker image, runtime configuration, nginx security headers, optional Bedrock
2. Static VPC reachability trace (A to B) with a TTL cache for AWS calls
3. UI/UX settings, reduced motion, optional local cache and restore-last-view
4. Optional: scan history, VPC Flow Logs analysis, Network Firewall support

## Project layout
```
app/          web application (React, TypeScript, Vite)
docker/       Dockerfile and nginx configuration
docs/         checkpoint and project notes
references/   pristine upstream copy, read-only
```

## Credits
Based on the work of the authors of aws-samples/sample-network-resilience-agent (MIT-0). See `NOTICE`.

## License
Apache License 2.0. See `LICENSE`.

## Contributing
Issues and pull requests are welcome. Keep changes small, tested and dependency-light.
