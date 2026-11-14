# syntax=docker/dockerfile:1
# Build from the project root:
#   docker build -f docker/Dockerfile -t aws-network-visualizer .     production image
#   docker build -f docker/Dockerfile --target test .                 run all unit tests in a container

FROM node:22-alpine AS deps
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci --no-audit --no-fund

# Tests run on Linux/alpine: the same shell and tools the image uses at runtime.
# docker/ is copied to /docker so the tests' ../../../docker paths resolve from /app/tests/docker.
FROM deps AS test
COPY app/ ./
COPY docker/ /docker/
RUN npm test

FROM deps AS build
COPY app/ ./
# nginx sets the CSP header at runtime, so drop the meta tag to avoid two conflicting policies
COPY docker/strip-csp-meta.mjs /tmp/strip-csp-meta.mjs
RUN node /tmp/strip-csp-meta.mjs index.html
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/headers.conf /etc/nginx/nwv/headers.conf
COPY --chmod=755 docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
