#!/bin/bash
# Auto-sync script
# Monitors directory and pushes to github automatically.

DIRECTORY=$(pwd)
echo "Watching folder: $DIRECTORY"

while true; do
  # Check git status for modifications or untracked files
  if [[ -n $(git status -s) ]]; then
    echo "Changes detected. Syncing..."
    git add .
    git commit -m "Auto sync: $(date '+%Y-%m-%d %H:%M:%S')"
    # Push using host network/credentials
    git push origin main
  fi
  sleep 10
done
