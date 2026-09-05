#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"
npm run build

# Publish only the build, without changing the source branch or working tree.
remote_url="$(git remote get-url origin)"
author_name="$(git config user.name)"
author_email="$(git config user.email)"
deploy_dir="$(mktemp -d "${TMPDIR:-/tmp}/ninja-gaiden-deploy.XXXXXX")"
trap 'rm -rf "$deploy_dir"' EXIT

git init --quiet "$deploy_dir"
git -C "$deploy_dir" remote add origin "$remote_url"
git -C "$deploy_dir" config user.name "$author_name"
git -C "$deploy_dir" config user.email "$author_email"
remote_branch="$(git ls-remote --heads origin refs/heads/deploy)"
if [[ -n "$remote_branch" ]]; then
  git -C "$deploy_dir" fetch --depth=1 origin deploy
  git -C "$deploy_dir" checkout -b deploy FETCH_HEAD
  git -C "$deploy_dir" rm -rf --ignore-unmatch .
else
  git -C "$deploy_dir" checkout --orphan deploy
fi

cp -R dist/. "$deploy_dir/"
cp assets/CREDITS.md "$deploy_dir/ASSET-CREDITS.md"
touch "$deploy_dir/.nojekyll"
git -C "$deploy_dir" add --all
if git -C "$deploy_dir" diff --cached --quiet; then
  echo "Deploy branch already contains the current build."
else
  git -C "$deploy_dir" commit -m "Deploy Shadow of the Dragon"
  git -C "$deploy_dir" push origin HEAD:deploy
fi
