#!/bin/bash
set -e

DATA_DIR="${DATA_DIR:-/data}"

mkdir -p "$DATA_DIR"

# Symlink Claude credentials from persistent volume to home dir
if [ -d "$DATA_DIR/.claude" ]; then
    ln -sfn "$DATA_DIR/.claude" /root/.claude
    echo "Linked existing Claude credentials from volume"
else
    mkdir -p "$DATA_DIR/.claude"
    ln -sfn "$DATA_DIR/.claude" /root/.claude
    echo "WARNING: No Claude credentials found. SSH in and run 'claude login'"
fi

exec node src/index.js
