#!/bin/bash
set -e

WORKSPACE="/home/nebulide/workspace"
PACKAGES_FILE="$WORKSPACE/.packages"
CLAUDE_MD_SRC="/app/CLAUDE.md"
CLAUDE_MD_DST="$WORKSPACE/CLAUDE.md"

# Copy CLAUDE.md to workspace if not present (first run)
if [ -f "$CLAUDE_MD_SRC" ] && [ ! -f "$CLAUDE_MD_DST" ]; then
  cp "$CLAUDE_MD_SRC" "$CLAUDE_MD_DST"
  echo "[entrypoint] CLAUDE.md copied to workspace."
fi

# Auto-install persisted apk packages
if [ -f "$PACKAGES_FILE" ]; then
  echo "[entrypoint] Installing persisted packages from $PACKAGES_FILE..."
  xargs -r apk add --no-cache < "$PACKAGES_FILE" 2>/dev/null || true
  echo "[entrypoint] Done."
fi

# Setup SSH keys (copy from read-only mount with correct permissions)
SSH_SOURCE="/root/.ssh-mount"
SSH_TARGET="/root/.ssh"
if [ -d "$SSH_SOURCE" ]; then
  mkdir -p "$SSH_TARGET"
  chmod 700 "$SSH_TARGET"
  for f in "$SSH_SOURCE"/*; do
    [ -f "$f" ] || continue
    cp "$f" "$SSH_TARGET/$(basename "$f")"
  done
  chmod 600 "$SSH_TARGET"/id_* 2>/dev/null || true
  chmod 644 "$SSH_TARGET"/*.pub 2>/dev/null || true
  chmod 644 "$SSH_TARGET"/known_hosts 2>/dev/null || true
  chmod 644 "$SSH_TARGET"/config 2>/dev/null || true
  echo "[entrypoint] SSH keys configured."
fi

# Ensure workspace ownership (volume mount may override)
chown -R nebulide:nebulide /home/nebulide/workspace 2>/dev/null || true

exec "$@"
