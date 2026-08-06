#!/usr/bin/env bash
#
# Install the Salesforce skills into another project, or into your home directory.
#
#   tools/install-skills.sh ~/code/my-sf-project        copy into that project
#   tools/install-skills.sh ~/code/my-sf-project --link symlink (edits here show up there)
#   tools/install-skills.sh --global                    copy into ~/.claude/skills
#   tools/install-skills.sh <target> --only sf-tdd,sf-data-deploy
#
# Existing skills of the same name are left alone unless you pass --force.

set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.claude/skills"

target=""
mode="copy"
force=0
only=""

while [ $# -gt 0 ]; do
  case "$1" in
    --global) target="$HOME/.claude/skills" ;;
    --link)   mode="link" ;;
    --force)  force=1 ;;
    --only)   shift; only="${1:-}" ;;
    -h|--help)
      # The comment block at the top of this file is the help text.
      awk 'NR > 1 { if ($0 ~ /^#/) { sub(/^# ?/, ""); print } else exit }' "$0"
      exit 0 ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 2 ;;
    *)
      # A project path — skills go in its .claude/skills.
      target="${1%/}/.claude/skills" ;;
  esac
  shift
done

if [ -z "$target" ]; then
  echo "Where should the skills go?" >&2
  echo "  tools/install-skills.sh ~/code/my-sf-project    or    --global" >&2
  exit 2
fi

if [ ! -d "$SOURCE_DIR" ]; then
  echo "No skills found at $SOURCE_DIR — run this from a clone of the toolkit repo." >&2
  exit 1
fi

mkdir -p "$target"

installed=0
skipped=0

for skill_path in "$SOURCE_DIR"/*/; do
  skill="$(basename "$skill_path")"

  # --only sf-tdd,sf-data-deploy
  if [ -n "$only" ] && ! printf '%s' ",$only," | grep -q ",$skill,"; then
    continue
  fi

  dest="$target/$skill"

  if [ -e "$dest" ] || [ -L "$dest" ]; then
    if [ "$force" -eq 1 ]; then
      rm -rf "$dest"
    else
      echo "  skip    $skill (already there — pass --force to replace)"
      skipped=$((skipped + 1))
      continue
    fi
  fi

  if [ "$mode" = "link" ]; then
    ln -s "${skill_path%/}" "$dest"
    echo "  link    $skill"
  else
    cp -R "${skill_path%/}" "$dest"
    echo "  copy    $skill"
  fi
  installed=$((installed + 1))
done

echo
echo "$installed installed, $skipped skipped → $target"

if [ "$installed" -gt 0 ]; then
  echo
  echo "Next: open that project in Claude Code — in a NEW session, so the skills are picked up."
  echo "Then try:  /sf-ticket-solution"
fi
