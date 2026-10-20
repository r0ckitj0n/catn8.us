<?php

declare(strict_types=1);

/**
 * Generate/rotate Rel8ed agent API token.
 * Writes hash to secrets table and plaintext token file mode 0600.
 * Usage: php scripts/rel8ed/generate_api_token.php
 * Never prints the token value.
 */

require_once dirname(__DIR__, 2) . '/api/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/rel8ed_model.php';

Rel8edModel::ensureSchema();
$token = Rel8edModel::rotateApiToken();
$path = Rel8edModel::writeLocalTokenFile($token);

echo "Rel8ed agent API token rotated.\n";
echo "Token hash stored under secrets key: " . Rel8edModel::AGENT_TOKEN_SECRET_KEY . "\n";
echo "Token file written (mode 600): " . $path . "\n";
echo "Token value intentionally not printed.\n";
