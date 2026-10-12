<?php

declare(strict_types=1);

/**
 * Generate/rotate Litig8 agent API token.
 * Writes hash to secrets table and plaintext token file mode 0600.
 * Usage: php scripts/litig8/generate_api_token.php
 * Never prints the token value.
 */

require_once dirname(__DIR__, 2) . '/api/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/litig8_model.php';

Litig8Model::ensureSchema();
$token = Litig8Model::rotateApiToken();
$path = Litig8Model::writeLocalTokenFile($token);

echo "Litig8 agent API token rotated.\n";
echo "Token hash stored under secrets key: " . Litig8Model::AGENT_TOKEN_SECRET_KEY . "\n";
echo "Token file written (mode 600): " . $path . "\n";
echo "Token value intentionally not printed.\n";
