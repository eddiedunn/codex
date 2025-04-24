#!/bin/bash
# Helper script to tail the latest Codex CLI log file

LOGDIR="${TMPDIR:-/tmp}/oai-codex"
LOGFILE="$LOGDIR/codex-cli-latest.log"

if [ ! -f "$LOGFILE" ]; then
  echo "Log file not found: $LOGFILE"
  exit 1
fi

echo "Tailing $LOGFILE (Ctrl+C to stop)"
tail -F "$LOGFILE"
