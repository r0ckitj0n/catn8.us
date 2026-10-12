<?php

declare(strict_types=1);

/**
 * Generate / rotate Celebr8 agent + relay API tokens.
 * Hashes are stored via secret_store; plaintext written under .local/state/celebr8/.
 *
 * Usage:
 *   php scripts/celebr8/generate_api_tokens.php
 *   php scripts/celebr8/generate_api_tokens.php --agent-only
 *   php scripts/celebr8/generate_api_tokens.php --relay-only
 */

require_once dirname(__DIR__, 2) . '/api/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/celebr8_model.php';

$agentOnly = in_array('--agent-only', $argv, true);
$relayOnly = in_array('--relay-only', $argv, true);
if (!$agentOnly && !$relayOnly) {
    $agentOnly = true;
    $relayOnly = true;
}

Celebr8Model::ensureSchema();

$paths = [];
if ($agentOnly) {
    $token = Celebr8Model::rotateApiToken(Celebr8Model::AGENT_TOKEN_SECRET_KEY);
    $paths['agent'] = Celebr8Model::writeLocalTokenFile('agent', $token);
}
if ($relayOnly) {
    $token = Celebr8Model::rotateApiToken(Celebr8Model::RELAY_TOKEN_SECRET_KEY);
    $paths['relay'] = Celebr8Model::writeLocalTokenFile('relay', $token);
}

fwrite(STDOUT, "Celebr8 API tokens rotated.\n");
fwrite(STDOUT, "Plaintext token paths (do not commit):\n");
foreach ($paths as $kind => $path) {
    fwrite(STDOUT, "  {$kind}: {$path}\n");
}
fwrite(STDOUT, "Server stores SHA-256 hashes in the secrets table under keys:\n");
if ($agentOnly) {
    fwrite(STDOUT, '  ' . Celebr8Model::AGENT_TOKEN_SECRET_KEY . "\n");
}
if ($relayOnly) {
    fwrite(STDOUT, '  ' . Celebr8Model::RELAY_TOKEN_SECRET_KEY . "\n");
}
