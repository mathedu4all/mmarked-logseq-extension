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
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  sed -i '' "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json
else
  # Linux
  sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json
fi

# Step 4: Run tests
echo -e "${GREEN}🧪 Running lint and build...${NC}"
npm run lint || { echo -e "${RED}Lint failed${NC}"; exit 1; }
npm run build || { echo -e "${RED}Build failed${NC}"; exit 1; }

# Step 5: Commit version bump
if git diff --quiet package.json; then
  echo -e "${YELLOW}No version change to commit (already ${VERSION}).${NC}"
else
  echo -e "${GREEN}💾 Committing version bump...${NC}"
  git add package.json
  git commit -m "chore: bump version to ${VERSION}"
fi

# Step 6: Create and push tag
echo -e "${GREEN}🏷️  Creating tag ${TAG}...${NC}"
git tag -a "${TAG}" -m "Release ${VERSION}"

# Step 7: Push changes
echo -e "${GREEN}⬆️  Pushing to origin...${NC}"
git push origin "${CURRENT_BRANCH}"
git push origin "${TAG}"

echo -e "\n${GREEN}✅ Release process completed!${NC}\n"
echo -e "Next steps:"
echo -e "1. Check GitHub Actions: ${YELLOW}https://github.com/mathedu4all/mmarked-logseq-extension/actions${NC}"
echo -e "2. Verify release: ${YELLOW}https://github.com/mathedu4all/mmarked-logseq-extension/releases/tag/${TAG}${NC}"
echo -e "3. If first release, follow: ${YELLOW}MARKETPLACE_SUBMISSION.md${NC}"
echo -e "4. For updates, marketplace will auto-detect the new version\n"
