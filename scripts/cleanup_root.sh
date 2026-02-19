#!/bin/bash

# Base backup directory
BACKUP_DIR="backups/cleanup_2025_11_19"

# Create directories
mkdir -p "$BACKUP_DIR/config_garbage"
mkdir -p "documentation/legacy"
mkdir -p "$BACKUP_DIR/js"
mkdir -p "$BACKUP_DIR/scripts"
mkdir -p "$BACKUP_DIR/artifacts"
mkdir -p "backups/secrets"

echo "Moving Configuration & Temporary Files..."
mv .disable-vite-dev "$BACKUP_DIR/config_garbage/" 2>/dev/null
mv .env.example "$BACKUP_DIR/config_garbage/" 2>/dev/null
mv .env.tmp "$BACKUP_DIR/config_garbage/" 2>/dev/null
mv .php-cs-fixer.cache "$BACKUP_DIR/config_garbage/" 2>/dev/null
mv deploy_dist.* "$BACKUP_DIR/config_garbage/" 2>/dev/null
mv hot "$BACKUP_DIR/config_garbage/" 2>/dev/null
mv start "$BACKUP_DIR/config_garbage/" 2>/dev/null
mv whimsicalfrog.sqlite "$BACKUP_DIR/config_garbage/" 2>/dev/null

echo "Moving Documentation..."
mv CONCURRENT_SERVER_SETUP.md documentation/legacy/ 2>/dev/null
mv FREEZE_DEBUG.md documentation/legacy/ 2>/dev/null
mv FREEZE_INVESTIGATION.md documentation/legacy/ 2>/dev/null
mv PROBLEM_SOLVED.md documentation/legacy/ 2>/dev/null
mv RELEASE_NOTES.md documentation/legacy/ 2>/dev/null

echo "Moving Displaced JavaScript..."
mv admin-room-map-editor.js "$BACKUP_DIR/js/" 2>/dev/null
mv admin-room-map-manager.js "$BACKUP_DIR/js/" 2>/dev/null
mv admin-settings-bridge.js "$BACKUP_DIR/js/" 2>/dev/null
mv analytics.js "$BACKUP_DIR/js/" 2>/dev/null
mv api-aliases.js "$BACKUP_DIR/js/" 2>/dev/null
mv api-client.js "$BACKUP_DIR/js/" 2>/dev/null
mv body-background-from-data.js "$BACKUP_DIR/js/" 2>/dev/null
mv check-shipping-rates.js "$BACKUP_DIR/js/" 2>/dev/null
mv checkout-modal.js "$BACKUP_DIR/js/" 2>/dev/null
mv contact.js "$BACKUP_DIR/js/" 2>/dev/null
mv direct-shipping-fix.js "$BACKUP_DIR/js/" 2>/dev/null
mv global-notifications.js "$BACKUP_DIR/js/" 2>/dev/null
mv header-auth-sync.js "$BACKUP_DIR/js/" 2>/dev/null
mv header-bootstrap.js "$BACKUP_DIR/js/" 2>/dev/null
mv header-offset.js "$BACKUP_DIR/js/" 2>/dev/null
mv help-documentation.js "$BACKUP_DIR/js/" 2>/dev/null
mv landing-page.js "$BACKUP_DIR/js/" 2>/dev/null
mv login-modal.js "$BACKUP_DIR/js/" 2>/dev/null
mv payment-modal.js "$BACKUP_DIR/js/" 2>/dev/null
mv receipt-modal.js "$BACKUP_DIR/js/" 2>/dev/null
mv reveal-company-modal.js "$BACKUP_DIR/js/" 2>/dev/null
mv room-coordinate-manager.js "$BACKUP_DIR/js/" 2>/dev/null
mv room-icons-init.js "$BACKUP_DIR/js/" 2>/dev/null
mv room-main.js "$BACKUP_DIR/js/" 2>/dev/null
mv utils.js "$BACKUP_DIR/js/" 2>/dev/null
mv wait-for-function.js "$BACKUP_DIR/js/" 2>/dev/null

echo "Moving Loose Scripts..."
mv check-shop-loader.php "$BACKUP_DIR/scripts/" 2>/dev/null
mv diagnostic.php "$BACKUP_DIR/scripts/" 2>/dev/null
mv fix.php "$BACKUP_DIR/scripts/" 2>/dev/null
mv health.php "$BACKUP_DIR/scripts/" 2>/dev/null
mv list-categories.php "$BACKUP_DIR/scripts/" 2>/dev/null
mv list-room-assignments.php "$BACKUP_DIR/scripts/" 2>/dev/null
mv print-active-coords.php "$BACKUP_DIR/scripts/" 2>/dev/null
mv report-items-by-category.php "$BACKUP_DIR/scripts/" 2>/dev/null
mv set_session.php "$BACKUP_DIR/scripts/" 2>/dev/null
mv test_diagnostic.php "$BACKUP_DIR/scripts/" 2>/dev/null
mv build.sh "$BACKUP_DIR/scripts/" 2>/dev/null
mv release.sh "$BACKUP_DIR/scripts/" 2>/dev/null
mv wf "$BACKUP_DIR/scripts/" 2>/dev/null
mv Makefile "$BACKUP_DIR/scripts/" 2>/dev/null

echo "Moving Logs & Artifacts..."
mv pagesource-router.html "$BACKUP_DIR/artifacts/" 2>/dev/null
mv pagesource.txt "$BACKUP_DIR/artifacts/" 2>/dev/null
mv test_api_diagnostics.html "$BACKUP_DIR/artifacts/" 2>/dev/null
mv test_concurrent_apis.html "$BACKUP_DIR/artifacts/" 2>/dev/null
mv .vite-dev.log "$BACKUP_DIR/artifacts/" 2>/dev/null
mv autostart.log "$BACKUP_DIR/artifacts/" 2>/dev/null
mv monitor.log "$BACKUP_DIR/artifacts/" 2>/dev/null
mv php_server.log "$BACKUP_DIR/artifacts/" 2>/dev/null
mv server.log "$BACKUP_DIR/artifacts/" 2>/dev/null

echo "Moving Secrets..."
mv whf_deploy_key backups/secrets/ 2>/dev/null
mv whf_deploy_key.pub backups/secrets/ 2>/dev/null

echo "Cleanup complete. Files moved to $BACKUP_DIR"
