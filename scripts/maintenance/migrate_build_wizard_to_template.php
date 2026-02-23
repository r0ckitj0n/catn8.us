<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

function usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/maintenance/migrate_build_wizard_to_template.php [--source-project-id=ID] [--source-title-like=TEXT] [--wastewater-kind=septic|public_sewer] [--water-kind=county_water|private_well] [--new-title=TITLE]\n";
}

function normalize_kind(string $value, array $allowed, string $default): string
{
    $v = strtolower(trim($value));
    return in_array($v, $allowed, true) ? $v : $default;
}

function qAll(PDO $pdo, string $sql, array $params = []): array
{
    $st = $pdo->prepare($sql);
    $st->execute($params);
    return $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function qOne(PDO $pdo, string $sql, array $params = []): ?array
{
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

function execSql(PDO $pdo, string $sql, array $params = []): void
{
    $st = $pdo->prepare($sql);
    $st->execute($params);
}

function text_key(string $value): string
{
    $v = strtolower(trim($value));
    $v = preg_replace('/[^a-z0-9]+/', ' ', $v);
    $v = preg_replace('/\s+/', ' ', (string)$v);
    return trim((string)$v);
}

function bounded_source_ref(string $value, int $maxLen = 255): string
{
    $text = trim($value);
    if ($text === '' || $maxLen <= 0) {
        return '';
    }
    if (strlen($text) <= $maxLen) {
        return $text;
    }

    $hash = substr(sha1($text), 0, 10);
    $suffix = '… [' . $hash . ']';
    $keep = $maxLen - strlen($suffix);
    if ($keep < 1) {
        return substr($hash, 0, $maxLen);
    }
    return rtrim(substr($text, 0, $keep)) . $suffix;
}

function load_template_steps(string $repoRoot, string $wastewaterKind, string $waterKind): array
{
    $basePath = $repoRoot . '/Build Wizard/seed/house_template.json';
    $base = json_decode((string)file_get_contents($basePath), true);
    if (!is_array($base) || !is_array($base['steps'] ?? null)) {
        throw new RuntimeException('Invalid base template JSON');
    }
    $steps = $base['steps'];

    $overridePaths = [];
    if ($wastewaterKind === 'public_sewer') {
        $overridePaths[] = $repoRoot . '/Build Wizard/seed/house_template_overrides_public_sewer.json';
    }
    if ($waterKind === 'private_well') {
        $overridePaths[] = $repoRoot . '/Build Wizard/seed/house_template_overrides_private_well.json';
    } else {
        $overridePaths[] = $repoRoot . '/Build Wizard/seed/house_template_overrides_county_water.json';
    }

    foreach ($overridePaths as $path) {
        if (!is_file($path)) {
            continue;
        }
        $ov = json_decode((string)file_get_contents($path), true);
        if (!is_array($ov)) {
            continue;
        }
        $remove = [];
        foreach ((array)($ov['remove_step_keys'] ?? []) as $k) {
            $kk = trim((string)$k);
            if ($kk !== '') {
                $remove[$kk] = true;
            }
        }
        $overrides = [];
        foreach ((array)($ov['step_overrides'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $k = trim((string)($row['template_step_key'] ?? ''));
            if ($k !== '') {
                $overrides[$k] = $row;
            }
        }

        $next = [];
        foreach ($steps as $step) {
            if (!is_array($step)) {
                continue;
            }
            $k = trim((string)($step['template_step_key'] ?? ''));
            if ($k !== '' && isset($remove[$k])) {
                continue;
            }
            if ($k !== '' && isset($overrides[$k])) {
                $step = array_merge($step, $overrides[$k]);
            }
            $next[] = $step;
        }
        foreach ((array)($ov['append_steps'] ?? []) as $append) {
            if (is_array($append) && trim((string)($append['template_step_key'] ?? '')) !== '' && trim((string)($append['title'] ?? '')) !== '') {
                $next[] = $append;
            }
        }
        $steps = $next;
    }

    return array_values($steps);
}

function phase_key_bucket(string $phase): string
{
    $p = strtolower(trim($phase));
    $map = [
        'land_due_diligence' => 'land_due_diligence',
        'design_preconstruction' => 'design_preconstruction',
        'dawson_county_permits' => 'dawson_county_permits',
        'site_preparation' => 'site_preparation',
        'foundation' => 'foundation',
        'framing_shell' => 'framing_shell',
        'mep_rough_in' => 'mep_rough_in',
        'interior_finishes' => 'interior_finishes',
        'move_in' => 'move_in',
        'inspections_closeout' => 'inspections_closeout',
        'general' => 'general',
        'permits' => 'dawson_county_permits',
        'sitework' => 'site_preparation',
        'framing' => 'framing_shell',
        'plumbing' => 'mep_rough_in',
        'mep' => 'mep_rough_in',
    ];
    return $map[$p] ?? 'general';
}

function step_type_norm(string $type, string $title): string
{
    $t = strtolower(trim($type));
    if ($t === 'receipt') {
        return 'purchase';
    }
    if ($t !== '') {
        return $t;
    }
    $s = strtolower($title);
    if (str_contains($s, 'permit') || str_contains($s, 'approval')) return 'permit';
    if (str_contains($s, 'inspect')) return 'inspection';
    if (str_contains($s, 'purchase') || str_contains($s, 'order')) return 'purchase';
    if (str_contains($s, 'document') || str_contains($s, 'survey')) return 'documentation';
    return 'construction';
}

function ensure_receipt_column(PDO $pdo): void
{
    $row = qOne(
        $pdo,
        'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
        ['build_wizard_documents', 'receipt_amount']
    );
    if (!$row) {
        execSql($pdo, 'ALTER TABLE build_wizard_documents ADD COLUMN receipt_amount DECIMAL(10,2) NULL AFTER caption');
    }
}

function ensure_project_columns(PDO $pdo): void
{
    $projectColumns = [
        'home_type' => "ALTER TABLE build_wizard_projects ADD COLUMN home_type VARCHAR(64) NOT NULL DEFAULT '' AFTER home_style",
        'bedrooms_count' => 'ALTER TABLE build_wizard_projects ADD COLUMN bedrooms_count INT NULL AFTER room_count',
        'kitchens_count' => 'ALTER TABLE build_wizard_projects ADD COLUMN kitchens_count INT NULL AFTER bedrooms_count',
        'lot_size_sqft' => 'ALTER TABLE build_wizard_projects ADD COLUMN lot_size_sqft INT NULL AFTER stories_count',
        'garage_spaces' => 'ALTER TABLE build_wizard_projects ADD COLUMN garage_spaces INT NULL AFTER lot_size_sqft',
        'parking_spaces' => 'ALTER TABLE build_wizard_projects ADD COLUMN parking_spaces INT NULL AFTER garage_spaces',
        'year_built' => 'ALTER TABLE build_wizard_projects ADD COLUMN year_built INT NULL AFTER parking_spaces',
        'hoa_fee_monthly' => 'ALTER TABLE build_wizard_projects ADD COLUMN hoa_fee_monthly DECIMAL(10,2) NULL AFTER year_built',
        'primary_photo_document_id' => 'ALTER TABLE build_wizard_projects ADD COLUMN primary_photo_document_id INT NULL AFTER blueprint_document_id',
        'ai_prompt_text' => 'ALTER TABLE build_wizard_projects ADD COLUMN ai_prompt_text LONGTEXT NULL AFTER primary_photo_document_id',
        'ai_payload_json' => 'ALTER TABLE build_wizard_projects ADD COLUMN ai_payload_json LONGTEXT NULL AFTER ai_prompt_text',
    ];
    foreach ($projectColumns as $column => $alterSql) {
        $exists = qOne(
            $pdo,
            'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
            ['build_wizard_projects', $column]
        );
        if (!$exists) {
            execSql($pdo, $alterSql);
        }
    }
}

function table_exists(PDO $pdo, string $tableName): bool
{
    $row = qOne(
        $pdo,
        'SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1',
        [$tableName]
    );
    return $row !== null;
}

$args = $argv;
array_shift($args);

$sourceProjectId = 0;
$sourceTitleLike = 'Cabin';
$wastewaterKind = 'septic';
$waterKind = 'county_water';
$newTitle = '';

foreach ($args as $arg) {
    if ($arg === '--help' || $arg === '-h') {
        usage();
        exit(0);
    }
    if (str_starts_with($arg, '--source-project-id=')) {
        $sourceProjectId = (int)substr($arg, 20);
        continue;
    }
    if (str_starts_with($arg, '--source-title-like=')) {
        $sourceTitleLike = trim((string)substr($arg, 20));
        continue;
    }
    if (str_starts_with($arg, '--wastewater-kind=')) {
        $wastewaterKind = normalize_kind((string)substr($arg, 18), ['septic', 'public_sewer'], 'septic');
        continue;
    }
    if (str_starts_with($arg, '--water-kind=')) {
        $waterKind = normalize_kind((string)substr($arg, 13), ['county_water', 'private_well'], 'county_water');
        continue;
    }
    if (str_starts_with($arg, '--new-title=')) {
        $newTitle = trim((string)substr($arg, 12));
    }
}

$cfg = catn8_get_db_config('local');
$pdo = Database::createConnection(
    (string)($cfg['host'] ?? ''),
    (string)($cfg['db'] ?? ''),
    (string)($cfg['user'] ?? ''),
    (string)($cfg['pass'] ?? ''),
    (int)($cfg['port'] ?? 3306),
    (string)($cfg['socket'] ?? '')
);

ensure_receipt_column($pdo);
ensure_project_columns($pdo);

$sourceProject = null;
if ($sourceProjectId > 0) {
    $sourceProject = qOne($pdo, 'SELECT * FROM build_wizard_projects WHERE id = ? LIMIT 1', [$sourceProjectId]);
}
if (!$sourceProject) {
    $sourceProject = qOne(
        $pdo,
        'SELECT * FROM build_wizard_projects WHERE title LIKE ? ORDER BY updated_at DESC, id DESC LIMIT 1',
        ['%' . $sourceTitleLike . '%']
    );
}
if (!$sourceProject) {
    throw new RuntimeException('Source project not found');
}

$sourceProjectId = (int)$sourceProject['id'];
$ownerId = (int)$sourceProject['owner_user_id'];
if ($ownerId <= 0) {
    throw new RuntimeException('Source project owner invalid');
}

if ($newTitle === '') {
    $newTitle = trim((string)$sourceProject['title']) . ' - Template Migrated ' . gmdate('Y-m-d');
}

$repoRoot = dirname(__DIR__, 2);
$templateSteps = load_template_steps($repoRoot, $wastewaterKind, $waterKind);
if (!$templateSteps) {
    throw new RuntimeException('Template has no steps');
}

$sourceSteps = qAll($pdo, 'SELECT * FROM build_wizard_steps WHERE project_id = ? ORDER BY step_order ASC, id ASC', [$sourceProjectId]);
$sourceNotes = qAll($pdo, 'SELECT * FROM build_wizard_step_notes WHERE step_id IN (SELECT id FROM build_wizard_steps WHERE project_id = ?)', [$sourceProjectId]);
$notesByStep = [];
foreach ($sourceNotes as $n) {
    $sid = (int)($n['step_id'] ?? 0);
    if ($sid <= 0) continue;
    $notesByStep[$sid][] = (string)($n['note_text'] ?? '');
}

$sourceDocs = qAll($pdo, 'SELECT * FROM build_wizard_documents WHERE project_id = ? ORDER BY id ASC', [$sourceProjectId]);

$pdo->beginTransaction();
try {
    execSql(
        $pdo,
        'INSERT INTO build_wizard_projects (owner_user_id, title, status, square_feet, home_style, home_type, room_count, bedrooms_count, kitchens_count, bathroom_count, stories_count, lot_size_sqft, garage_spaces, parking_spaces, year_built, hoa_fee_monthly, lot_address, target_start_date, target_completion_date, wizard_notes, blueprint_document_id, primary_photo_document_id, ai_prompt_text, ai_payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)',
        [
            $ownerId,
            $newTitle,
            (string)($sourceProject['status'] ?? 'planning'),
            $sourceProject['square_feet'] !== null ? (int)$sourceProject['square_feet'] : null,
            (string)($sourceProject['home_style'] ?? ''),
            (string)($sourceProject['home_type'] ?? ''),
            $sourceProject['room_count'] !== null ? (int)$sourceProject['room_count'] : null,
            $sourceProject['bedrooms_count'] !== null ? (int)$sourceProject['bedrooms_count'] : null,
            $sourceProject['kitchens_count'] !== null ? (int)$sourceProject['kitchens_count'] : null,
            $sourceProject['bathroom_count'] !== null ? (int)$sourceProject['bathroom_count'] : null,
            $sourceProject['stories_count'] !== null ? (int)$sourceProject['stories_count'] : null,
            $sourceProject['lot_size_sqft'] !== null ? (int)$sourceProject['lot_size_sqft'] : null,
            $sourceProject['garage_spaces'] !== null ? (int)$sourceProject['garage_spaces'] : null,
            $sourceProject['parking_spaces'] !== null ? (int)$sourceProject['parking_spaces'] : null,
            $sourceProject['year_built'] !== null ? (int)$sourceProject['year_built'] : null,
            $sourceProject['hoa_fee_monthly'] !== null ? (string)$sourceProject['hoa_fee_monthly'] : null,
            (string)($sourceProject['lot_address'] ?? ''),
            $sourceProject['target_start_date'] ?? null,
            $sourceProject['target_completion_date'] ?? null,
            (string)($sourceProject['wizard_notes'] ?? ''),
            (string)($sourceProject['ai_prompt_text'] ?? ''),
            (string)($sourceProject['ai_payload_json'] ?? '')
        ]
    );
    $targetProjectId = (int)$pdo->lastInsertId();

    $templateStepIdByKey = [];
    $phaseFirstTemplateStepId = [];
    $stepOrder = 1;
    foreach ($templateSteps as $tpl) {
        $phaseKey = phase_key_bucket((string)($tpl['phase_key'] ?? 'general'));
        $stepType = step_type_norm((string)($tpl['step_type'] ?? ''), (string)($tpl['title'] ?? ''));
        execSql(
            $pdo,
            'INSERT INTO build_wizard_steps
             (project_id, step_order, phase_key, depends_on_step_ids_json, step_type, title, description, permit_required, permit_name, expected_start_date, expected_end_date, expected_duration_days, estimated_cost, actual_cost, ai_estimated_fields_json, is_completed, completed_at, ai_generated, source_ref)
             VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, 0, NULL, 0, ?)',
            [
                $targetProjectId,
                $stepOrder,
                $phaseKey,
                $stepType,
                trim((string)($tpl['title'] ?? 'Template Step')),
                trim((string)($tpl['description'] ?? '')),
                !empty($tpl['permit_required']) ? 1 : 0,
                trim((string)($tpl['permit_name'] ?? '')) ?: null,
                isset($tpl['expected_duration_days']) && is_numeric($tpl['expected_duration_days']) ? (int)$tpl['expected_duration_days'] : null,
                bounded_source_ref(trim((string)($tpl['source_ref'] ?? 'Template'))),
            ]
        );
        $newStepId = (int)$pdo->lastInsertId();
        $tplKey = trim((string)($tpl['template_step_key'] ?? ''));
        if ($tplKey !== '') {
            $templateStepIdByKey[$tplKey] = $newStepId;
        }
        if (!isset($phaseFirstTemplateStepId[$phaseKey])) {
            $phaseFirstTemplateStepId[$phaseKey] = $newStepId;
        }
        $stepOrder++;
    }

    // wire template dependencies
    foreach ($templateSteps as $tpl) {
        $tplKey = trim((string)($tpl['template_step_key'] ?? ''));
        $stepId = (int)($templateStepIdByKey[$tplKey] ?? 0);
        if ($stepId <= 0) continue;
        $depIds = [];
        foreach ((array)($tpl['depends_on_keys'] ?? []) as $depKey) {
            $depId = (int)($templateStepIdByKey[trim((string)$depKey)] ?? 0);
            if ($depId > 0 && $depId !== $stepId) {
                $depIds[] = $depId;
            }
        }
        $depIds = array_values(array_unique($depIds));
        execSql($pdo, 'UPDATE build_wizard_steps SET depends_on_step_ids_json = ? WHERE id = ?', [$depIds ? json_encode($depIds, JSON_UNESCAPED_SLASHES) : null, $stepId]);
    }

    $targetSteps = qAll($pdo, 'SELECT * FROM build_wizard_steps WHERE project_id = ? ORDER BY step_order ASC, id ASC', [$targetProjectId]);
    $defaultTargetStepId = (int)($targetSteps[0]['id'] ?? 0);

    // map source steps to template steps (many-to-one) to maximize reuse of template structure
    $closeoutStepId = (int)($templateStepIdByKey['closeout_docs'] ?? 0);
    $sourceToTarget = [];
    $sourceToScore = [];
    $mappedByTarget = [];

    foreach ($sourceSteps as $sourceStep) {
        $sid = (int)($sourceStep['id'] ?? 0);
        if ($sid <= 0) {
            continue;
        }
        $srcTitle = (string)($sourceStep['title'] ?? '');
        $srcKey = text_key($srcTitle);
        $srcPhase = phase_key_bucket((string)($sourceStep['phase_key'] ?? ''));
        $srcType = step_type_norm((string)($sourceStep['step_type'] ?? ''), $srcTitle);
        $srcTokens = array_values(array_filter(explode(' ', $srcKey), static fn($t) => strlen((string)$t) >= 4));

        $bestTargetId = 0;
        $bestScore = -1;
        foreach ($targetSteps as $targetStep) {
            $targetId = (int)($targetStep['id'] ?? 0);
            if ($targetId <= 0) {
                continue;
            }
            $targetTitle = (string)($targetStep['title'] ?? '');
            $targetKey = text_key($targetTitle);
            $targetPhase = phase_key_bucket((string)($targetStep['phase_key'] ?? ''));
            $targetType = step_type_norm((string)($targetStep['step_type'] ?? ''), $targetTitle);

            $score = 0;
            if ($srcKey !== '' && $srcKey === $targetKey) {
                $score += 120;
            }
            similar_text($srcKey, $targetKey, $pct);
            $score += (int)round($pct * 0.45);
            if ($srcPhase === $targetPhase) {
                $score += 22;
            }
            if ($srcType === $targetType) {
                $score += 18;
            }
            if ($srcTokens) {
                $overlap = 0;
                foreach ($srcTokens as $token) {
                    if (str_contains($targetKey, $token)) {
                        $overlap++;
                    }
                }
                $score += min(20, $overlap * 4);
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestTargetId = $targetId;
            }
        }

        if ($bestTargetId <= 0 || $bestScore < 28) {
            $bestTargetId = $closeoutStepId > 0 ? $closeoutStepId : (int)($targetSteps[0]['id'] ?? 0);
        }
        if ($bestTargetId <= 0) {
            continue;
        }
        $sourceToTarget[$sid] = $bestTargetId;
        $sourceToScore[$sid] = max(0, $bestScore);
        $mappedByTarget[$bestTargetId][] = $sourceStep;
    }

    // overlay aggregated source data onto each template step
    foreach ($targetSteps as $targetStep) {
        $targetId = (int)($targetStep['id'] ?? 0);
        $mappedSources = $mappedByTarget[$targetId] ?? [];
        if (!$mappedSources) {
            continue;
        }

        usort($mappedSources, function (array $a, array $b) use ($sourceToScore): int {
            $sa = (int)($sourceToScore[(int)($a['id'] ?? 0)] ?? 0);
            $sb = (int)($sourceToScore[(int)($b['id'] ?? 0)] ?? 0);
            if ($sa !== $sb) {
                return $sb <=> $sa;
            }
            return ((int)($a['id'] ?? 0)) <=> ((int)($b['id'] ?? 0));
        });
        $primary = $mappedSources[0];

        $startDates = [];
        $endDates = [];
        $estimatedTotal = 0.0;
        $actualTotal = 0.0;
        $estimatedCount = 0;
        $actualCount = 0;
        $allCompleted = true;
        $sourceRefs = [];
        foreach ($mappedSources as $src) {
            $sid = (int)($src['id'] ?? 0);
            $st = trim((string)($src['expected_start_date'] ?? ''));
            $en = trim((string)($src['expected_end_date'] ?? ''));
            if ($st !== '') {
                $startDates[] = $st;
            }
            if ($en !== '') {
                $endDates[] = $en;
            }
            if ($src['estimated_cost'] !== null && is_numeric($src['estimated_cost'])) {
                $estimatedTotal += (float)$src['estimated_cost'];
                $estimatedCount++;
            }
            if ($src['actual_cost'] !== null && is_numeric($src['actual_cost'])) {
                $actualTotal += (float)$src['actual_cost'];
                $actualCount++;
            }
            if ((int)($src['is_completed'] ?? 0) !== 1) {
                $allCompleted = false;
            }
            $sourceRefs[] = '#' . $sid . ' ' . trim((string)($src['title'] ?? ''));
        }
        sort($startDates);
        rsort($endDates);

        $sourceRef = trim((string)($targetStep['source_ref'] ?? ''));
        $appendRef = 'Migrated from source steps: ' . implode('; ', array_slice($sourceRefs, 0, 12));
        $sourceRef = $sourceRef !== '' ? ($sourceRef . ' | ' . $appendRef) : $appendRef;
        $sourceRef = bounded_source_ref($sourceRef);

        execSql(
            $pdo,
            'UPDATE build_wizard_steps
             SET expected_start_date = COALESCE(?, expected_start_date), expected_end_date = COALESCE(?, expected_end_date), expected_duration_days = COALESCE(?, expected_duration_days), estimated_cost = COALESCE(?, estimated_cost), actual_cost = COALESCE(?, actual_cost), is_completed = ?, completed_at = ?, permit_required = GREATEST(permit_required, ?), permit_name = COALESCE(permit_name, ?), permit_authority = COALESCE(permit_authority, ?), permit_status = COALESCE(permit_status, ?), purchase_category = COALESCE(?, purchase_category), purchase_brand = COALESCE(?, purchase_brand), purchase_model = COALESCE(?, purchase_model), purchase_sku = COALESCE(?, purchase_sku), purchase_unit = COALESCE(?, purchase_unit), purchase_qty = COALESCE(?, purchase_qty), purchase_unit_price = COALESCE(?, purchase_unit_price), purchase_vendor = COALESCE(?, purchase_vendor), purchase_url = COALESCE(?, purchase_url), source_ref = ?
             WHERE id = ? AND project_id = ?',
            [
                $startDates ? $startDates[0] : null,
                $endDates ? $endDates[0] : null,
                $primary['expected_duration_days'] !== null ? (int)$primary['expected_duration_days'] : null,
                $estimatedCount > 0 ? number_format($estimatedTotal, 2, '.', '') : null,
                $actualCount > 0 ? number_format($actualTotal, 2, '.', '') : null,
                $allCompleted ? 1 : 0,
                $allCompleted ? ($primary['completed_at'] ?? gmdate('Y-m-d H:i:s')) : null,
                (int)($primary['permit_required'] ?? 0),
                trim((string)($primary['permit_name'] ?? '')) ?: null,
                trim((string)($primary['permit_authority'] ?? '')) ?: null,
                trim((string)($primary['permit_status'] ?? '')) ?: null,
                trim((string)($primary['purchase_category'] ?? '')) ?: null,
                trim((string)($primary['purchase_brand'] ?? '')) ?: null,
                trim((string)($primary['purchase_model'] ?? '')) ?: null,
                trim((string)($primary['purchase_sku'] ?? '')) ?: null,
                trim((string)($primary['purchase_unit'] ?? '')) ?: null,
                $primary['purchase_qty'] !== null ? (string)$primary['purchase_qty'] : null,
                $primary['purchase_unit_price'] !== null ? (string)$primary['purchase_unit_price'] : null,
                trim((string)($primary['purchase_vendor'] ?? '')) ?: null,
                trim((string)($primary['purchase_url'] ?? '')) ?: null,
                $sourceRef,
                $targetId,
                $targetProjectId,
            ]
        );

        $mappingNote = 'Mapped source steps: ' . implode('; ', array_slice($sourceRefs, 0, 20));
        execSql($pdo, 'INSERT INTO build_wizard_step_notes (step_id, note_text) VALUES (?, ?)', [$targetId, $mappingNote]);

        foreach ($mappedSources as $src) {
            $sid = (int)($src['id'] ?? 0);
            foreach (($notesByStep[$sid] ?? []) as $noteText) {
                $noteText = trim((string)$noteText);
                if ($noteText === '') {
                    continue;
                }
                execSql($pdo, 'INSERT INTO build_wizard_step_notes (step_id, note_text) VALUES (?, ?)', [$targetId, $noteText]);
            }
        }
    }

    // copy documents, preserving as many step links as possible
    $sourceDocToTargetDoc = [];
    $sourceStepById = [];
    foreach ($sourceSteps as $s) {
        $sourceStepById[(int)$s['id']] = $s;
    }

    foreach ($sourceDocs as $doc) {
        $sourceDocId = (int)($doc['id'] ?? 0);
        if ($sourceDocId <= 0) continue;
        $oldStepId = (int)($doc['step_id'] ?? 0);
        $targetStepId = (int)($sourceToTarget[$oldStepId] ?? 0);
        if ($targetStepId <= 0 && $oldStepId > 0 && isset($sourceStepById[$oldStepId])) {
            $fallbackPhase = phase_key_bucket((string)($sourceStepById[$oldStepId]['phase_key'] ?? 'general'));
            $targetStepId = (int)($phaseFirstTemplateStepId[$fallbackPhase] ?? $closeoutStepId);
        }
        if ($targetStepId <= 0) {
            $targetStepId = $closeoutStepId > 0 ? $closeoutStepId : $defaultTargetStepId;
        }

        execSql(
            $pdo,
            'INSERT INTO build_wizard_documents (project_id, step_id, receipt_parent_document_id, kind, original_name, mime_type, storage_path, file_size_bytes, caption, receipt_amount, receipt_title, receipt_vendor, receipt_date, receipt_notes, uploaded_at)
             VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $targetProjectId,
                $targetStepId > 0 ? $targetStepId : null,
                (string)($doc['kind'] ?? 'other'),
                (string)($doc['original_name'] ?? 'document'),
                (string)($doc['mime_type'] ?? 'application/octet-stream'),
                (string)($doc['storage_path'] ?? ''),
                (int)($doc['file_size_bytes'] ?? 0),
                $doc['caption'] !== null ? (string)$doc['caption'] : null,
                $doc['receipt_amount'] !== null ? (string)$doc['receipt_amount'] : null,
                $doc['receipt_title'] !== null ? (string)$doc['receipt_title'] : null,
                $doc['receipt_vendor'] !== null ? (string)$doc['receipt_vendor'] : null,
                $doc['receipt_date'] ?? null,
                $doc['receipt_notes'] !== null ? (string)$doc['receipt_notes'] : null,
                (string)($doc['uploaded_at'] ?? gmdate('Y-m-d H:i:s')),
            ]
        );
        $targetDocId = (int)$pdo->lastInsertId();
        $sourceDocToTargetDoc[$sourceDocId] = $targetDocId;
    }

    // copy blobs/images for copied docs
    foreach ($sourceDocToTargetDoc as $sourceDocId => $targetDocId) {
        $blobRow = qOne($pdo, 'SELECT mime_type, file_blob, file_size_bytes FROM build_wizard_document_blobs WHERE document_id = ? LIMIT 1', [(int)$sourceDocId]);
        if ($blobRow && is_string($blobRow['file_blob'] ?? null)) {
            execSql(
                $pdo,
                'INSERT INTO build_wizard_document_blobs (document_id, mime_type, file_blob, file_size_bytes)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), file_blob = VALUES(file_blob), file_size_bytes = VALUES(file_size_bytes)',
                [$targetDocId, (string)($blobRow['mime_type'] ?? 'application/octet-stream'), $blobRow['file_blob'], (int)($blobRow['file_size_bytes'] ?? 0)]
            );
        }

        $imgRow = qOne($pdo, 'SELECT mime_type, image_blob, width_px, height_px, file_size_bytes FROM build_wizard_document_images WHERE document_id = ? LIMIT 1', [(int)$sourceDocId]);
        if ($imgRow && is_string($imgRow['image_blob'] ?? null)) {
            execSql(
                $pdo,
                'INSERT INTO build_wizard_document_images (document_id, mime_type, image_blob, width_px, height_px, file_size_bytes)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), image_blob = VALUES(image_blob), width_px = VALUES(width_px), height_px = VALUES(height_px), file_size_bytes = VALUES(file_size_bytes)',
                [
                    $targetDocId,
                    (string)($imgRow['mime_type'] ?? 'image/jpeg'),
                    $imgRow['image_blob'],
                    $imgRow['width_px'] !== null ? (int)$imgRow['width_px'] : null,
                    $imgRow['height_px'] !== null ? (int)$imgRow['height_px'] : null,
                    (int)($imgRow['file_size_bytes'] ?? 0),
                ]
            );
        }
    }

    // carry over primary refs when possible
    $sourcePrimaryBlueprint = (int)($sourceProject['blueprint_document_id'] ?? 0);
    $sourcePrimaryPhoto = (int)($sourceProject['primary_photo_document_id'] ?? 0);
    $targetPrimaryBlueprint = (int)($sourceDocToTargetDoc[$sourcePrimaryBlueprint] ?? 0);
    $targetPrimaryPhoto = (int)($sourceDocToTargetDoc[$sourcePrimaryPhoto] ?? 0);
    execSql(
        $pdo,
        'UPDATE build_wizard_projects SET blueprint_document_id = ?, primary_photo_document_id = ? WHERE id = ?',
        [$targetPrimaryBlueprint > 0 ? $targetPrimaryBlueprint : null, $targetPrimaryPhoto > 0 ? $targetPrimaryPhoto : null, $targetProjectId]
    );

    if (table_exists($pdo, 'build_wizard_phase_date_ranges')) {
        $sourcePhaseRanges = qAll(
            $pdo,
            'SELECT phase_tab, start_date, end_date FROM build_wizard_phase_date_ranges WHERE project_id = ?',
            [$sourceProjectId]
        );
        foreach ($sourcePhaseRanges as $range) {
            $phaseTab = trim((string)($range['phase_tab'] ?? ''));
            if ($phaseTab === '') {
                continue;
            }
            execSql(
                $pdo,
                'INSERT INTO build_wizard_phase_date_ranges (project_id, phase_tab, start_date, end_date)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE start_date = VALUES(start_date), end_date = VALUES(end_date)',
                [
                    $targetProjectId,
                    $phaseTab,
                    $range['start_date'] ?? null,
                    $range['end_date'] ?? null,
                ]
            );
        }
    }

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'source_project_id' => $sourceProjectId,
        'target_project_id' => $targetProjectId,
        'target_title' => $newTitle,
        'template_steps' => count($templateSteps),
        'source_steps' => count($sourceSteps),
        'matched_steps' => count($sourceToTarget),
        'unmatched_steps' => max(0, count($sourceSteps) - count($sourceToTarget)),
        'source_documents' => count($sourceDocs),
        'copied_documents' => count($sourceDocToTargetDoc),
        'wastewater_kind' => $wastewaterKind,
        'water_kind' => $waterKind,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, '[error] ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
