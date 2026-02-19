<?php
if ($action === 'delete_job') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $jobId = (int)($body['job_id'] ?? 0);

    $requireCase($caseId);
    if ($jobId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'job_id is required'], 400);
    }

    $job = Database::queryOne('SELECT id, game_id, status FROM mystery_generation_jobs WHERE id = ?', [$jobId]);
    if (!$job) {
        catn8_json_response(['success' => false, 'error' => 'Job not found'], 404);
    }
    if ((int)($job['game_id'] ?? 0) !== $caseId) {
        catn8_json_response(['success' => false, 'error' => 'Job does not belong to this case'], 400);
    }
    if ((string)($job['status'] ?? '') !== 'queued') {
        catn8_json_response(['success' => false, 'error' => 'Only queued jobs can be deleted'], 400);
    }

    $deleted = Database::execute('DELETE FROM mystery_generation_jobs WHERE id = ? AND status = ?', [$jobId, 'queued']);
    catn8_json_response(['success' => true, 'deleted' => (int)$deleted]);
}

if ($action === 'clear_queue') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $scenarioId = isset($body['scenario_id']) ? (int)($body['scenario_id'] ?? 0) : 0;

    $requireCase($caseId);
    if ($scenarioId > 0) {
        $scenario = $requireScenario($scenarioId);
        if ((int)($scenario['game_id'] ?? 0) !== $caseId) {
            catn8_json_response(['success' => false, 'error' => 'Scenario does not belong to this case'], 400);
        }
    }

    $sql = "DELETE FROM mystery_generation_jobs WHERE game_id = ? AND status = 'queued'";
    $params = [$caseId];
    if ($scenarioId > 0) {
        $sql .= ' AND scenario_id = ?';
        $params[] = $scenarioId;
    }

    $deleted = Database::execute($sql, $params);
    catn8_json_response(['success' => true, 'deleted' => (int)$deleted]);
}

if ($action === 'clear_completed_jobs') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $requireCase($caseId);

    $deleted = Database::execute(
        "DELETE FROM mystery_generation_jobs WHERE game_id = ? AND status IN ('done','error','canceled','failed')",
        [$caseId]
    );
    catn8_json_response(['success' => true, 'deleted' => (int)$deleted]);
}

if ($action === 'list_jobs') {
    $caseId = (int)($_GET['case_id'] ?? 0);
    $requireCase($caseId);
    $rows = Database::queryAll(
        'SELECT id, game_id, scenario_id, entity_id, action, status, error_text, created_at, updated_at
         FROM mystery_generation_jobs
         WHERE game_id = ?
         ORDER BY id DESC
         LIMIT 50',
        [$caseId]
    );
    $jobs = array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'case_id' => (int)($r['game_id'] ?? 0),
            'scenario_id' => (int)($r['scenario_id'] ?? 0),
            'entity_id' => (int)($r['entity_id'] ?? 0),
            'action' => (string)($r['action'] ?? ''),
            'status' => (string)($r['status'] ?? ''),
            'error_text' => (string)($r['error_text'] ?? ''),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }, $rows);
    catn8_json_response(['success' => true, 'jobs' => $jobs]);
}

if ($action === 'enqueue_job') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $scenarioId = isset($body['scenario_id']) ? (int)($body['scenario_id'] ?? 0) : null;
    $entityId = isset($body['entity_id']) ? (int)($body['entity_id'] ?? 0) : null;
    $jobAction = trim((string)($body['action'] ?? ''));
    $spec = $body['spec'] ?? [];

    $requireCase($caseId);
    if ($scenarioId !== null && $scenarioId > 0) {
        $scenario = $requireScenario($scenarioId);
        if ((int)($scenario['game_id'] ?? 0) !== $caseId) {
            catn8_json_response(['success' => false, 'error' => 'Scenario does not belong to this case'], 400);
        }
    }
    if ($entityId !== null && $entityId > 0) {
        $entity = $requireEntity($entityId);
        if ((int)($entity['game_id'] ?? 0) !== $caseId) {
            catn8_json_response(['success' => false, 'error' => 'Entity does not belong to this case'], 400);
        }
    }
    if ($jobAction === '') {
        catn8_json_response(['success' => false, 'error' => 'action is required'], 400);
    }
    if (!is_array($spec)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid spec'], 400);
    }

    Database::execute(
        'INSERT INTO mystery_generation_jobs (game_id, scenario_id, entity_id, action, spec_json, status, result_json, error_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [$caseId, ($scenarioId && $scenarioId > 0) ? $scenarioId : null, ($entityId && $entityId > 0) ? $entityId : null, $jobAction, json_encode($spec), 'queued', json_encode(new stdClass()), '']
    );
    $row = Database::queryOne('SELECT id FROM mystery_generation_jobs WHERE game_id = ? ORDER BY id DESC LIMIT 1', [$caseId]);
    catn8_json_response(['success' => true, 'id' => (int)($row['id'] ?? 0)]);
}
