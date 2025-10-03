#!/bin/bash
# Release script for MMarked Logseq Plugin
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 1.4.0

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if version is provided
if [ -z "$1" ]; then
  echo -e "${RED}Error: Version number required${NC}"
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 1.4.0"
  exit 1
fi

VERSION=$1
TAG="v${VERSION}"

echo -e "${GREEN}🚀 Starting release process for version ${VERSION}${NC}\n"

# Pre-flight: ensure tag doesn't already exist remotely
echo -e "${GREEN}🔍 Checking remote for existing tag ${TAG}...${NC}"
if git ls-remote --tags origin | grep -q "refs/tags/${TAG}$"; then
  echo -e "${RED}Error: Tag ${TAG} already exists on origin. Abort.${NC}"
  exit 1
fi

# Pre-flight: ensure CHANGELOG contains version section
if ! grep -q "^## \[${VERSION}\]" CHANGELOG.md; then
  echo -e "${YELLOW}Warning: CHANGELOG.md has no section for ${VERSION}.${NC}"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Step 1: Check if on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${YELLOW}Warning: You are on branch '${CURRENT_BRANCH}', not 'main'${NC}"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Step 2: Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo -e "${RED}Error: You have uncommitted changes${NC}"
  git status -s
  exit 1
fi

# Step 3: Update package.json version (if not already that version)
CURRENT_PKG_VERSION=$(grep '"version"' package.json | head -1 | sed -E 's/.*"version" *: *"([^"]+)".*/\1/')
if [ "$CURRENT_PKG_VERSION" = "$VERSION" ]; then
  echo -e "${YELLOW}package.json already at version ${VERSION}, skipping bump rewrite.${NC}"
else
  echo -e "${GREEN}📝 Updating package.json version...${NC}"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json
  else
    sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json
  fi
fi

# Step 4: Generate / update changelog (strict)
if npm run | grep -q "changelog"; then
  echo -e "${GREEN}🧾 Generating changelog via 'npm run changelog' (strict)...${NC}"
  npm run changelog || { echo -e "${RED}Changelog failed. Aborting release.${NC}"; exit 1; }
  echo -e "${GREEN}✅ Changelog updated${NC}"
else
  echo -e "${YELLOW}No 'changelog' npm script detected, skipping changelog generation.${NC}"
fi

# Step 5: Run lint & build
echo -e "${GREEN}🧪 Running lint and build...${NC}"
npm run lint || { echo -e "${RED}Lint failed${NC}"; exit 1; }
npm run build || { echo -e "${RED}Build failed${NC}"; exit 1; }

# Step 5.1: Sync upstream mmarked browser bundle if changed
UPSTREAM_URL="https://raw.githubusercontent.com/mathedu4all/mmarked/main/dist/browser.umd.js"
LOCAL_FILE="src/browser.umd.js"
echo -e "${GREEN}🔄 Checking upstream browser.umd.js...${NC}"
TMP_FILE=$(mktemp)
if curl -fsSL -o "$TMP_FILE" "$UPSTREAM_URL"; then
  if [ -f "$LOCAL_FILE" ]; then
    LOCAL_HASH=$(shasum -a 256 "$LOCAL_FILE" | awk '{print $1}')
    REMOTE_HASH=$(shasum -a 256 "$TMP_FILE" | awk '{print $1}')
    if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
      echo -e "${YELLOW}Upstream bundle changed. Updating local copy.${NC}"
      mv "$TMP_FILE" "$LOCAL_FILE"
      BROWSER_UPDATED=1
    else
      echo -e "${GREEN}Local bundle already up-to-date.${NC}"
      rm "$TMP_FILE"
    fi
  else
    echo -e "${YELLOW}Local bundle missing. Fetching new copy.${NC}"
    mv "$TMP_FILE" "$LOCAL_FILE"
    BROWSER_UPDATED=1
  fi
else
  echo -e "${RED}Failed to fetch upstream browser.umd.js (network or URL issue). Continuing without update.${NC}"
  rm -f "$TMP_FILE" 2>/dev/null || true
fi

# Step 6: Commit version bump + changelog + upstream bundle (if changed)
if git diff --quiet package.json CHANGELOG.md "$LOCAL_FILE"; then
  echo -e "${YELLOW}No version/changelog/bundle changes to commit.${NC}"
else
  echo -e "${GREEN}💾 Committing release artifacts...${NC}"
  git add package.json CHANGELOG.md "$LOCAL_FILE"
  COMMIT_MSG="chore: release ${VERSION} (version + changelog"
  if [ "$BROWSER_UPDATED" = "1" ]; then
    COMMIT_MSG+=" + mmarked bundle"
  fi
  COMMIT_MSG+=")"
  git commit -m "$COMMIT_MSG"
fi

# Step 7: Create and push tag
echo -e "${GREEN}🏷️  Creating tag ${TAG}...${NC}"
git tag -a "${TAG}" -m "Release ${VERSION}"

# Step 8: Push changes
echo -e "${GREEN}⬆️  Pushing to origin...${NC}"
git push origin "${CURRENT_BRANCH}"
git push origin "${TAG}"

echo -e "\n${GREEN}✅ Release process completed!${NC}\n"
echo -e "Next steps:"
echo -e "1. Check GitHub Actions: ${YELLOW}https://github.com/mathedu4all/mmarked-logseq-extension/actions${NC}"
echo -e "2. Verify release: ${YELLOW}https://github.com/mathedu4all/mmarked-logseq-extension/releases/tag/${TAG}${NC}"
echo -e "3. Marketplace auto-detects the new version (no manual resubmission needed)\n"
