#!/bin/bash

# Base backup directory
BACKUP_DIR="backups/cleanup_2025_11_19"

# Ensure target directories exist
mkdir -p "$BACKUP_DIR/scripts"
mkdir -p "$BACKUP_DIR/sections/tools"

echo "Moving Test & Debug Scripts..."
mv sections/test_branding.php "$BACKUP_DIR/scripts/" 2>/dev/null
mv sections/tools/php_info.php "$BACKUP_DIR/sections/tools/" 2>/dev/null
mv sections/tools/db_quick.php "$BACKUP_DIR/sections/tools/" 2>/dev/null

echo "Subdirectory cleanup complete."
