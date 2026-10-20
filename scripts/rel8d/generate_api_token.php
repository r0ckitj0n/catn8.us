<?php

declare(strict_types=1);

/**
 * Generate/rotate Rel8d agent API token.
 * Writes hash to secrets table and plaintext token file mode 0600.
 * Usage: php scripts/rel8d/generate_api_token.php
 * Never prints the token value.
 */

require_once dirname(__DIR__, 2) . '/api/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/rel8d_model.php';

Rel8dModel::ensureSchema();
$token = Rel8dModel::rotateApiToken();
$path = Rel8dModel::writeLocalTokenFile($token);

echo "Rel8d agent API token rotated.\n";
echo "Token hash stored under secrets key: " . Rel8dModel::AGENT_TOKEN_SECRET_KEY . "\n";
echo "Token file written (mode 600): " . $path . "\n";
echo "Token value intentionally not printed.\n";
