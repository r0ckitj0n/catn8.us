<?php
declare(strict_types=1);

function catn8_mystery_require_csi_law_enforcement_character(int $mysteryId, array $entityRow): void {
    if (!catn8_mystery_is_csi_law_enforcement_character($mysteryId, $entityRow)) {
        throw new RuntimeException('Character is not a law enforcement officer');
    }
}

function catn8_mystery_is_csi_law_enforcement_character(int $mysteryId, array $entityRow): bool {
    $role = strtolower(trim((string)($entityRow['role'] ?? '')));
    return (strpos($role, 'police') !== false || strpos($role, 'detective') !== false || strpos($role, 'sheriff') !== false || strpos($role, 'officer') !== false || strpos($role, 'agent') !== false);
}

function catn8_mystery_require_mystery(int $mysteryId, int $viewerId, bool $isAdmin): array {
    $mid = (int)$mysteryId;
    if ($mid <= 0) throw new RuntimeException('Invalid Mystery ID');
    $row = Database::queryOne('SELECT * FROM mystery_mysteries WHERE id = ? LIMIT 1', [$mid]);
    if (!$row) throw new RuntimeException('Mystery not found');
    
    if (!$isAdmin && (int)($row['owner_user_id'] ?? 0) !== $viewerId) {
        throw new RuntimeException('Not authorized');
    }
    
    return $row;
}

function catn8_mystery_require_case(int $caseId, int $viewerId, bool $isAdmin): array {
    $cid = (int)$caseId;
    if ($cid <= 0) throw new RuntimeException('Invalid Case ID');
    $row = Database::queryOne('SELECT * FROM mystery_games WHERE id = ? LIMIT 1', [$cid]);
    if (!$row) throw new RuntimeException('Case not found');
    
    if (!$isAdmin && (int)($row['owner_user_id'] ?? 0) !== $viewerId) {
        throw new RuntimeException('Not authorized');
    }
    
    return $row;
}

function catn8_mystery_require_scenario(int $scenarioId, int $viewerId, bool $isAdmin): array {
    $sid = (int)$scenarioId;
    if ($sid <= 0) throw new RuntimeException('Invalid Scenario ID');
    $row = Database::queryOne('SELECT * FROM mystery_scenarios WHERE id = ? LIMIT 1', [$sid]);
    if (!$row) throw new RuntimeException('Scenario not found');
    
    // Check case ownership
    catn8_mystery_require_case((int)($row['game_id'] ?? 0), $viewerId, $isAdmin);
    
    return $row;
}

function catn8_mystery_ensure_default_csi_detective(int $scenarioId, int $viewerId, bool $isAdmin): void {
    $sid = (int)$scenarioId;
    $scenario = catn8_mystery_require_scenario($sid, $viewerId, $isAdmin);
    if (!empty($scenario['csi_detective_entity_id'])) return;

    $caseId = (int)$scenario['game_id'];
    $detective = Database::queryOne("SELECT id FROM mystery_entities WHERE game_id = ? AND entity_type = 'character' AND (LOWER(roles_json) LIKE '%detective%' OR LOWER(roles_json) LIKE '%sheriff%' OR LOWER(roles_json) LIKE '%police%' OR LOWER(roles_json) LIKE '%officer%' OR LOWER(roles_json) LIKE '%agent%') LIMIT 1", [$caseId]);
    if ($detective) {
        Database::execute('UPDATE mystery_scenarios SET csi_detective_entity_id = ? WHERE id = ?', [(int)$detective['id'], $sid]);
    }
}
