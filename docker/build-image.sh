#!/bin/sh
# Build the AWS Network Visualizer image, and optionally run it, with Docker, Podman or
# nerdctl. Paths are resolved from this file's location, so it works from any directory.
#
#   docker/build-image.sh                 run the unit tests in a container, then build the image
#   docker/build-image.sh --run           ... and start it on http://127.0.0.1:8080
#   docker/build-image.sh --skip-tests    build only
#   docker/build-image.sh --dry-run       print the commands without running them
#
# Plain POSIX sh on purpose: it also runs in the Alpine test stage, where the repo's own
# tests check its behaviour (app/tests/docker/build-image.test.mjs).
set -eu

usage() {
  cat <<'EOF_USAGE'
Usage: docker/build-image.sh [options]

Builds the image from the project root. By default it first runs the unit tests in a
container (the "test" stage) and only builds the production image if they pass.

Options:
  --engine NAME     docker, podman or nerdctl
                    (default: $CONTAINER_ENGINE, else the first one found in that order)
  --tag NAME:TAG    image name (default: aws-network-visualizer:dev). When this is a git
                    checkout a second tag with the commit is added, e.g. :4e680b7
  --skip-tests      skip the test stage
  --no-cache        build without the layer cache
  --platform P      target platform, e.g. linux/amd64 or linux/arm64
  --run             start the image after building: read-only, no capabilities, and
                    published on 127.0.0.1 only
  --name NAME       container name for --run (default: nwv). A container with this
                    name is replaced.
  --port N          host port for --run (default: 8080)
  --dry-run         print the commands instead of running them
  -h, --help        show this help
EOF_USAGE
}

die() { echo "build-image: $*" >&2; exit 2; }
fail() { echo "build-image: $*" >&2; exit 1; }
say() { printf '\n==> %s\n' "$*"; }

need_value() { [ "$#" -ge 2 ] || die "$1 needs a value"; }

# valid <value> <extended regex> <what>
valid() { printf '%s' "$1" | grep -Eq "$2" || die "invalid $3: $1"; }

# Print the command (dry run) or execute it.
run() {
  if [ "$DRY" = 1 ]; then
    printf '+'
    for a in "$@"; do printf ' %s' "$a"; done
    printf '\n'
  else
    "$@"
  fi
}

ENGINE="${CONTAINER_ENGINE:-}"
TAG="aws-network-visualizer:dev"
NAME="nwv"
PORT="8080"
PLATFORM=""
RUN=0
SKIP_TESTS=0
NO_CACHE=0
DRY=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --engine) need_value "$@"; ENGINE="$2"; shift 2 ;;
    --tag) need_value "$@"; TAG="$2"; shift 2 ;;
    --platform) need_value "$@"; PLATFORM="$2"; shift 2 ;;
    --name) need_value "$@"; NAME="$2"; shift 2 ;;
    --port) need_value "$@"; PORT="$2"; shift 2 ;;
    --skip-tests) SKIP_TESTS=1; shift ;;
    --no-cache) NO_CACHE=1; shift ;;
    --run) RUN=1; shift ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "unknown option: $1" ;;
  esac
done

# Everything below goes into commands as separate arguments (never through eval),
# but reject odd values early so mistakes read clearly.
valid "$TAG" '^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,200}$' "tag"
valid "$NAME" '^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$' "container name"
valid "$PORT" '^[0-9]{1,5}$' "port"
{ [ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ]; } || die "invalid port: $PORT"
if [ -n "$PLATFORM" ]; then valid "$PLATFORM" '^[a-z0-9]+/[a-z0-9]+(/[a-z0-9]+)?$' "platform"; fi
if [ -n "$ENGINE" ]; then valid "$ENGINE" '^(docker|podman|nerdctl)$' "engine (use docker, podman or nerdctl)"; fi

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
{ [ -f "$ROOT/docker/Dockerfile" ] && [ -f "$ROOT/app/package.json" ]; } ||
  fail "expected docker/Dockerfile and app/package.json under $ROOT"

if [ -z "$ENGINE" ]; then
  for e in docker podman nerdctl; do
    if command -v "$e" >/dev/null 2>&1; then ENGINE="$e"; break; fi
  done
fi
[ -n "$ENGINE" ] || fail "no container engine found (looked for docker, podman, nerdctl)"

if [ "$DRY" = 0 ] && ! "$ENGINE" info >/dev/null 2>&1; then
  fail "$ENGINE is installed but not responding. Start it first (Docker Desktop, 'colima start', or 'podman machine start')."
fi

# Image name without the tag, so the commit tag can be built from it.
case "${TAG##*/}" in
  *:*) REPO="${TAG%:*}" ;;
  *) REPO="$TAG" ;;
esac

# engine_build <extra build args...>: always builds docker/Dockerfile with the project root as context.
engine_build() {
  set -- build -f docker/Dockerfile "$@"
  if [ "$NO_CACHE" = 1 ]; then set -- "$@" --no-cache; fi
  if [ -n "$PLATFORM" ]; then set -- "$@" --platform "$PLATFORM"; fi
  # Podman builds OCI images by default, which silently drops the HEALTHCHECK.
  if [ "$ENGINE" = podman ]; then set -- "$@" --format docker; fi
  set -- "$@" .
  (cd "$ROOT" && run "$ENGINE" "$@")
}

wait_healthy() {
  url="http://127.0.0.1:$PORT/healthz"
  i=0
  while [ "$i" -lt 30 ]; do
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS -m 2 "$url" >/dev/null 2>&1; then echo "healthy: $url answered"; return 0; fi
    elif command -v wget >/dev/null 2>&1; then
      if wget -q -T 2 -O /dev/null "$url" 2>/dev/null; then echo "healthy: $url answered"; return 0; fi
    else
      echo "(neither curl nor wget found: skipping the health check)"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "build-image: no answer from $url after 30 s. Logs: $ENGINE logs $NAME" >&2
  return 1
}

# 1. Tests, in a container, on the same shell and tools the image uses.
if [ "$SKIP_TESTS" = 0 ]; then
  say "Running the unit tests in a container (test stage)"
  IID_FILE=$(mktemp)
  engine_build --target test --iidfile "$IID_FILE" ||
    fail "the test stage failed, so no image was built"
  # The test image only exists to run the tests. Remove it so unnamed images do not pile up
  # (layers shared with the production build stay).
  if [ "$DRY" = 0 ] && [ -s "$IID_FILE" ]; then
    "$ENGINE" rmi -f "$(cat "$IID_FILE")" >/dev/null 2>&1 || true
  fi
  rm -f "$IID_FILE"
fi

# 2. The production image.
say "Building $TAG"
SHA_TAG=""
if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --short HEAD >/dev/null 2>&1; then
  SHA=$(git -C "$ROOT" rev-parse --short HEAD)
  if [ -n "$(git -C "$ROOT" status --porcelain 2>/dev/null)" ]; then SHA="$SHA-dirty"; fi
  SHA_TAG="$REPO:$SHA"
fi
if [ -n "$SHA_TAG" ]; then
  engine_build -t "$TAG" -t "$SHA_TAG" || fail "the image build failed"
else
  engine_build -t "$TAG" || fail "the image build failed"
fi
if [ "$DRY" = 0 ]; then
  say "Image"
  "$ENGINE" images "$REPO"
fi

# 3. Optionally run it.
if [ "$RUN" = 1 ]; then
  say "Starting $NAME on http://127.0.0.1:$PORT (read-only, no capabilities)"
  if [ "$DRY" = 1 ]; then
    run "$ENGINE" rm -f "$NAME"
  else
    "$ENGINE" rm -f "$NAME" >/dev/null 2>&1 || true
  fi
  set -- run -d --name "$NAME" --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true
  if [ -n "$PLATFORM" ]; then set -- "$@" --platform "$PLATFORM"; fi
  set -- "$@" -p "127.0.0.1:$PORT:8080" "$TAG"
  run "$ENGINE" "$@" || fail "could not start the container (is port $PORT already in use? try --port)"
  if [ "$DRY" = 0 ]; then wait_healthy || exit 1; fi
fi

say "Done"
if [ "$RUN" = 1 ]; then
  echo "Open http://127.0.0.1:$PORT   (stop it with: $ENGINE rm -f $NAME)"
else
  echo "Start it with: docker/build-image.sh --skip-tests --run"
fi
