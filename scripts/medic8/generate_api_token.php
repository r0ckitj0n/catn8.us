<?php

declare(strict_types=1);

/**
 * Generate/rotate Medic8 agent API token.
 * Writes hash to secrets table and plaintext token file mode 0600.
 * Usage: php scripts/medic8/generate_api_token.php
 * Never prints the token value to logs/CI.
 */

require_once dirname(__DIR__, 2) . '/api/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/medic8_model.php';

Medic8Model::ensureSchema();
$token = Medic8Model::rotateApiToken();
$path = Medic8Model::writeLocalTokenFile($token);

echo "Medic8 agent API token rotated.\n";
echo "Token hash stored under secrets key: " . Medic8Model::AGENT_TOKEN_SECRET_KEY . "\n";
echo "Token file written (mode 600): " . $path . "\n";
echo "Token value intentionally not printed.\n";
