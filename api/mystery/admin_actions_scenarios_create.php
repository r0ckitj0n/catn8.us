<?php
if ($action === 'create_scenario') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $requireCase($caseId);

    $slug = trim((string)($body['slug'] ?? ''));
    $title = trim((string)($body['title'] ?? ''));
    $status = trim((string)($body['status'] ?? 'draft'));
    if ($status === '') $status = 'draft';

    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'Title is required'], 400);
    }

    $slug = ($slug === '')
        ? catn8_mystery_unique_slug($title, static function (string $candidate) use ($caseId): bool {
            return Database::queryOne('SELECT id FROM mystery_scenarios WHERE game_id = ? AND slug = ? LIMIT 1', [$caseId, $candidate]) !== null;
        })
        : catn8_mystery_unique_slug($slug, static function (string $candidate) use ($caseId): bool {
            return Database::queryOne('SELECT id FROM mystery_scenarios WHERE game_id = ? AND slug = ? LIMIT 1', [$caseId, $candidate]) !== null;
        });

    Database::execute(
        'INSERT INTO mystery_scenarios (game_id, slug, title, status, specs_json, constraints_json) VALUES (?, ?, ?, ?, ?, ?)',
        [$caseId, $slug, $title, $status, json_encode(new stdClass()), json_encode(new stdClass())]
    );
    $row = Database::queryOne('SELECT id FROM mystery_scenarios WHERE game_id = ? AND slug = ?', [$caseId, $slug]);
    catn8_json_response(['success' => true, 'id' => (int)($row['id'] ?? 0)]);
}
