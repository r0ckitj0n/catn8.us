<?php
if ($action === 'list_entities') {
    $caseId = (int)($_GET['case_id'] ?? 0);
    $entityType = trim((string)($_GET['entity_type'] ?? ''));
    $includeData = (int)($_GET['include_data'] ?? 0) === 1;
    $caseRow = $requireCase($caseId);
    $mysteryId = (int)($caseRow['mystery_id'] ?? 0);

    $params = [$caseId];
    $sql = 'SELECT id, game_id, entity_type, slug, name, roles_json, is_archived, accent_preference, created_at, updated_at';
    if ($includeData) {
        $sql .= ', data_json';
    }
    $sql .= ' FROM mystery_entities WHERE game_id = ?';
    if ($entityType !== '') {
        $sql .= ' AND entity_type = ?';
        $params[] = $entityType;
    }
    $sql .= ' ORDER BY updated_at DESC, id DESC';

    $rows = Database::queryAll($sql, $params);
    $entities = array_map(static function (array $r) use ($includeData, $mysteryId): array {
        $roles = json_decode((string)($r['roles_json'] ?? '[]'), true);
        if (!is_array($roles)) $roles = [];
        $roles = array_values(array_filter(array_map(static fn($v) => trim((string)$v), $roles), static fn($v) => $v !== ''));
        $out = [
            'id' => (int)($r['id'] ?? 0),
            'case_id' => (int)($r['game_id'] ?? 0),
            'entity_type' => (string)($r['entity_type'] ?? ''),
            'slug' => (string)($r['slug'] ?? ''),
            'name' => (string)($r['name'] ?? ''),
            'roles' => $roles,
            'is_archived' => (int)($r['is_archived'] ?? 0),
            'accent_preference' => (string)($r['accent_preference'] ?? ''),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
        if ($includeData) {
            $data = json_decode((string)($r['data_json'] ?? '{}'), true);
            if (!is_array($data)) $data = [];
            $out['data'] = $data;

            $masterSlug = trim((string)($data['master_slug'] ?? ''));
            $out['master_slug'] = $masterSlug;
            $out['master_asset_id'] = catn8_mystery_resolve_master_asset_id($mysteryId, (string)($r['entity_type'] ?? ''), $masterSlug);
        }
        return $out;
    }, $rows);
    catn8_json_response(['success' => true, 'entities' => $entities]);
}

if ($action === 'list_scenario_entities') {
    $scenarioId = (int)($_GET['scenario_id'] ?? 0);
    $scenario = $requireScenario($scenarioId);
    $caseRow = $requireCase((int)($scenario['game_id'] ?? 0));
    $mysteryId = (int)($caseRow['mystery_id'] ?? 0);

    $rows = Database::queryAll(
        'SELECT se.*, e.entity_type, e.slug, e.name, e.data_json, e.roles_json,
                (SELECT mc.agent_id 
                 FROM mystery_master_characters mc 
                 WHERE mc.slug = e.slug OR mc.id = JSON_UNQUOTE(JSON_EXTRACT(e.data_json, "$.master_id"))
                 LIMIT 1) as master_agent_id
         FROM mystery_scenario_entities se
         INNER JOIN mystery_entities e ON e.id = se.entity_id
         WHERE se.scenario_id = ?
         ORDER BY e.entity_type ASC, e.name ASC, se.id ASC',
        [$scenarioId]
    );

    $items = array_map(static function (array $r) use ($mysteryId): array {
        $override = json_decode((string)($r['override_json'] ?? '{}'), true);
        if (!is_array($override)) $override = [];

        $data = json_decode((string)($r['data_json'] ?? '{}'), true);
        if (!is_array($data)) $data = [];

        $roles = json_decode((string)($r['roles_json'] ?? '[]'), true);
        if (!is_array($roles)) $roles = [];
        $roles = array_values(array_filter(array_map(static fn($v) => trim((string)$v), $roles), static fn($v) => $v !== ''));
        $masterSlug = trim((string)($data['master_slug'] ?? ''));
        $masterAssetId = catn8_mystery_resolve_master_asset_id($mysteryId, (string)($r['entity_type'] ?? ''), $masterSlug);
        
        $agentId = (int)($data['agent_id'] ?? 0);
        if ($agentId <= 0 && isset($r['master_agent_id'])) {
            $agentId = (int)$r['master_agent_id'];
        }

        return [
            'id' => (int)($r['id'] ?? 0),
            'scenario_id' => (int)($r['scenario_id'] ?? 0),
            'entity_id' => (int)($r['entity_id'] ?? 0),
            'role' => (string)($r['role'] ?? ''),
            'roles' => $roles,
            'override' => $override,
            'entity_type' => (string)($r['entity_type'] ?? ''),
            'entity_slug' => (string)($r['slug'] ?? ''),
            'entity_name' => (string)($r['name'] ?? ''),
            'agent_id' => $agentId,
            'data' => $data,
            'master_slug' => $masterSlug,
            'master_asset_id' => $masterAssetId,
        ];
    }, $rows);

    catn8_json_response([
        'success' => true,
        'scenario' => [
            'id' => (int)($scenario['id'] ?? 0),
            'game_id' => (int)($scenario['game_id'] ?? 0),
        ],
        'scenario_entities' => $items,
    ]);
}
