#!/usr/bin/env sh
set -euo pipefail

# mirror setup & validation for GitHub release sync
# Environment:
#   GITHUB_KEY: private key content
#   TAG_NAME: optional; will be derived if not provided

log() { printf '\033[1;34m[github_sync]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[github_sync][error]\033[0m %s\n' "$*" >&2; }

auth_setup() {
  log "Setting up SSH"
  mkdir -p ~/.ssh
  chmod 700 ~/.ssh
  ssh-keyscan github.com > ~/.ssh/known_hosts 2>/dev/null || true
  chmod 644 ~/.ssh/known_hosts
  printf '%s' "$GITHUB_KEY" > ~/.ssh/github.key
  chmod 400 ~/.ssh/github.key
}

add_remote() {
  if git remote get-url github >/dev/null 2>&1; then
    log "Remote github already exists"
  else
    log "Adding github remote"
    git remote add github git@github.com:mathedu4all/mmarked-logseq-extension.git
  fi
}

derive_tag() {
  if [ -z "${TAG_NAME:-}" ]; then
    TAG_NAME=$(git describe --tags --exact-match 2>/dev/null || true)
  fi
  if [ -z "$TAG_NAME" ]; then
    err "No exact tag found (job should be tags-only)"
    exit 1
  fi
  log "Tag detected: $TAG_NAME"
}

check_version_alignment() {
  PKG_VERSION=$(grep '"version"' package.json | head -1 | sed -E 's/.*"version" *: *"([^"]+)".*/\1/')
  CLEAN_TAG=${TAG_NAME#v}
  if [ "$PKG_VERSION" != "$CLEAN_TAG" ]; then
    err "Version mismatch: package.json=$PKG_VERSION tag=$CLEAN_TAG"
    exit 1
  fi
  log "Version matches tag ($PKG_VERSION)"
}

push_refs() {
  log "Pushing main branch"
  GIT_SSH_COMMAND='ssh -i ~/.ssh/github.key' git push github HEAD:main
  log "Pushing tag $TAG_NAME"
  GIT_SSH_COMMAND='ssh -i ~/.ssh/github.key' git push github "$TAG_NAME"
}

main() {
  auth_setup
  add_remote
  derive_tag
  check_version_alignment
  push_refs
  log "Sync complete"
}

main "$@"
