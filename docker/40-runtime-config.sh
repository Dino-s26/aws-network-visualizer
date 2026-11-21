#!/bin/sh
# Runs before nginx starts. Writes:
#   /tmp/nwv/config.js  runtime settings read by the browser (window.__CONFIG__)
#   /tmp/nwv/csp.conf   Content-Security-Policy header for nginx
# Every value is whitelisted to safe characters so env input cannot inject script or headers.
set -eu
set -f

OUT="${NWV_OUT:-/tmp/nwv}"
mkdir -p "$OUT"

clean()  { printf '%s' "$1" | tr -cd 'A-Za-z0-9 ._:/@+=-'; }
cleanw() { printf '%s' "$1" | tr -cd 'A-Za-z0-9 ._:/*-'; }
str()    { printf '"%s"' "$(clean "$1")"; }

enabled=false
[ "$(clean "${BEDROCK_ENABLED:-false}")" = "true" ] && enabled=true

# Direct Connect stays on unless DX_ENABLED is exactly "false"
dx=true
[ "$(clean "${DX_ENABLED:-true}")" = "false" ] && dx=false

max_rounds="$(printf '%s' "${MAX_TOOL_ROUNDS:-}" | tr -cd '0-9')"
: "${max_rounds:=0}"

cat > "$OUT/config.js" <<EOF
window.__CONFIG__ = {
  bedrockEnabled: $enabled,
  dxEnabled: $dx,
  bedrockModelId: $(str "${BEDROCK_MODEL_ID:-}"),
  bedrockGuardrailId: $(str "${BEDROCK_GUARDRAIL_ID:-}"),
  bedrockGuardrailVersion: $(str "${BEDROCK_GUARDRAIL_VERSION:-}"),
  defaultRegion: $(str "${DEFAULT_REGION:-}"),
  defaultScenario: $(str "${DEFAULT_SCENARIO:-}"),
  appTitle: $(str "${APP_TITLE:-}"),
  ssoBackendUrl: $(str "${SSO_BACKEND_URL:-}"),
  maxToolRounds: $max_rounds
};
EOF

# CSP connect-src: AWS APIs, plus the SSO backend origin and any CSP_CONNECT_EXTRA origins
origin_re='^https?://(\*\.)?[A-Za-z0-9.-]+(:[0-9]+)?$'
extra=""
add() { if printf '%s' "$1" | grep -Eq "$origin_re"; then extra="$extra $1"; fi; }

sso="$(clean "${SSO_BACKEND_URL:-}")"
if [ -n "$sso" ]; then add "$(printf '%s' "$sso" | sed -E 's#^(https?://[^/]+).*#\1#')"; fi
for o in $(cleanw "${CSP_CONNECT_EXTRA:-}"); do add "$o"; done

csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://*.amazonaws.com$extra; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
printf 'add_header Content-Security-Policy "%s" always;\n' "$csp" > "$OUT/csp.conf"

echo "40-runtime-config: wrote $OUT/config.js and $OUT/csp.conf (bedrock=$enabled)"
