#!/usr/bin/env bash
# mask-secrets-in-logs.sh
# Masks secrets in all log files in ./mcptools-logs before uploading as CI artifacts

set -euo pipefail

# Allow opt-out via MASK_MCPTOOL_LOGS=0
if [[ "${MASK_MCPTOOL_LOGS:-1}" == "0" ]]; then
  echo "[mask-secrets-in-logs.sh] Secret masking disabled via MASK_MCPTOOL_LOGS=0"
  exit 0
fi

SECRET_PATTERNS=(
  "$(printenv OPENAI_API_KEY || true)"
  "$(printenv MCP_SECRET || true)"
  "[A-Za-z0-9_-]\{32,\}" # generic token pattern
  "eyJ[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*" # JWT pattern
)

for logfile in ./mcptools-logs/*.log; do
  [ -f "$logfile" ] || continue
  cp "$logfile" "$logfile.bak"
  for pat in "${SECRET_PATTERNS[@]}"; do
    if [[ -n "$pat" && "$pat" != "[A-Za-z0-9_-]\{32,\}" && "$pat" != "eyJ[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*" ]]; then
      # Mask exact env var matches
      sed -i.bak "/$pat/ s/$pat/***MASKED***/g" "$logfile"
    fi
  done
  # Mask generic patterns
  sed -i.bak -E 's/[A-Za-z0-9_-]{32,}/***MASKED***/g' "$logfile"
  sed -i.bak -E 's/eyJ[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*\.[0-9a-zA-Z_-]*/***MASKED***/g' "$logfile"
  rm "$logfile.bak"
done
