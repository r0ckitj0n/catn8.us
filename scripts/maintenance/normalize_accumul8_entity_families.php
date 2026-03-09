<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/bootstrap.php';
require_once __DIR__ . '/../../includes/accumul8_entity_normalization.php';

function accumul8_entity_family_assign_alias(int $ownerUserId, int $entityId, string $aliasName, array $reassignableEntityIds = []): string
{
    $displayAlias = accumul8_entity_alias_display_name($aliasName);
    $aliasKey = accumul8_entity_match_key(accumul8_entity_alias_name($aliasName));
    if ($displayAlias === '' || $aliasKey === '') {
        return 'invalid';
    }

    $target = Database::queryOne(
        'SELECT display_name
         FROM accumul8_entities
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$entityId, $ownerUserId]
    );
    if (!$target) {
        return 'missing_target';
    }

    if (accumul8_entity_match_key($displayAlias) === accumul8_entity_match_key((string)($target['display_name'] ?? ''))) {
        return 'matches_display_name';
    }

    $existing = Database::queryOne(
        'SELECT id, entity_id
         FROM accumul8_entity_aliases
         WHERE owner_user_id = ? AND alias_key = ?
         LIMIT 1',
        [$ownerUserId, $aliasKey]
    );
    if ($existing) {
        $existingId = (int)($existing['id'] ?? 0);
        $existingEntityId = (int)($existing['entity_id'] ?? 0);
        if ($existingId <= 0) {
            return 'invalid_existing';
        }
        if ($existingEntityId !== $entityId) {
            if (!in_array($existingEntityId, $reassignableEntityIds, true)) {
                return 'conflict';
            }
            Database::execute(
                'UPDATE accumul8_entity_aliases
                 SET entity_id = ?, alias_name = ?
                 WHERE id = ? AND owner_user_id = ?',
                [$entityId, $displayAlias, $existingId, $ownerUserId]
            );
            return 'reassigned';
        }
        Database::execute(
            'UPDATE accumul8_entity_aliases
             SET alias_name = ?
             WHERE id = ? AND owner_user_id = ?',
            [$displayAlias, $existingId, $ownerUserId]
        );
        return 'updated';
    }

    Database::execute(
        'INSERT INTO accumul8_entity_aliases (owner_user_id, entity_id, alias_name, alias_key)
         VALUES (?, ?, ?, ?)',
        [$ownerUserId, $entityId, $displayAlias, $aliasKey]
    );

    return 'created';
}

function accumul8_entity_family_merge_group(int $ownerUserId, string $parentName, array $rows): array
{
    usort($rows, static function (array $a, array $b) use ($parentName): int {
        $aExact = strcasecmp((string)($a['display_name'] ?? ''), $parentName) === 0 ? 0 : 1;
        $bExact = strcasecmp((string)($b['display_name'] ?? ''), $parentName) === 0 ? 0 : 1;
        if ($aExact !== $bExact) {
            return $aExact <=> $bExact;
        }
        return ((int)($a['id'] ?? 0)) <=> ((int)($b['id'] ?? 0));
    });

    $target = $rows[0] ?? null;
    if (!is_array($target) || (int)($target['id'] ?? 0) <= 0) {
        return ['renamed' => 0, 'merged' => 0, 'aliases' => 0];
    }

    $targetId = (int)$target['id'];
    $targetOriginalName = (string)($target['display_name'] ?? '');
    $groupEntityIds = array_values(array_map(static fn(array $row): int => (int)($row['id'] ?? 0), $rows));
    $aliasesTouched = 0;
    $mergedCount = 0;
    $renamed = 0;

    Database::beginTransaction();
    try {
        if (strcasecmp($targetOriginalName, $parentName) !== 0) {
            Database::execute(
                'UPDATE accumul8_entities
                 SET display_name = ?
                 WHERE id = ? AND owner_user_id = ?',
                [$parentName, $targetId, $ownerUserId]
            );
            $renamed = 1;
            $aliasResult = accumul8_entity_family_assign_alias($ownerUserId, $targetId, $targetOriginalName, $groupEntityIds);
            if (in_array($aliasResult, ['created', 'updated', 'reassigned'], true)) {
                $aliasesTouched++;
            }
        }

        foreach (array_slice($rows, 1) as $source) {
            $sourceId = (int)($source['id'] ?? 0);
            if ($sourceId <= 0 || $sourceId === $targetId) {
                continue;
            }

            $aliasResult = accumul8_entity_family_assign_alias($ownerUserId, $targetId, (string)($source['display_name'] ?? ''), $groupEntityIds);
            if (in_array($aliasResult, ['created', 'updated', 'reassigned'], true)) {
                $aliasesTouched++;
            }

            $sourceAliases = Database::queryAll(
                'SELECT alias_name
                 FROM accumul8_entity_aliases
                 WHERE owner_user_id = ? AND entity_id = ?
                 ORDER BY id ASC',
                [$ownerUserId, $sourceId]
            );
            foreach ($sourceAliases as $aliasRow) {
                $aliasResult = accumul8_entity_family_assign_alias($ownerUserId, $targetId, (string)($aliasRow['alias_name'] ?? ''), $groupEntityIds);
                if (in_array($aliasResult, ['created', 'updated', 'reassigned'], true)) {
                    $aliasesTouched++;
                }
            }

            Database::execute(
                'UPDATE accumul8_contacts
                 SET entity_id = ?
                 WHERE owner_user_id = ? AND entity_id = ?',
                [$targetId, $ownerUserId, $sourceId]
            );
            Database::execute(
                'UPDATE accumul8_debtors
                 SET entity_id = ?
                 WHERE owner_user_id = ? AND entity_id = ?',
                [$targetId, $ownerUserId, $sourceId]
            );
            Database::execute(
                'UPDATE accumul8_recurring_payments
                 SET entity_id = ?
                 WHERE owner_user_id = ? AND entity_id = ?',
                [$targetId, $ownerUserId, $sourceId]
            );
            Database::execute(
                'UPDATE accumul8_transactions
                 SET entity_id = ?
                 WHERE owner_user_id = ? AND entity_id = ?',
                [$targetId, $ownerUserId, $sourceId]
            );
            Database::execute(
                'UPDATE accumul8_transactions
                 SET balance_entity_id = ?
                 WHERE owner_user_id = ? AND balance_entity_id = ?',
                [$targetId, $ownerUserId, $sourceId]
            );
            Database::execute(
                'DELETE FROM accumul8_entity_aliases
                 WHERE owner_user_id = ? AND entity_id = ?',
                [$ownerUserId, $sourceId]
            );
            Database::execute(
                'DELETE FROM accumul8_entities
                 WHERE id = ? AND owner_user_id = ?',
                [$sourceId, $ownerUserId]
            );
            $mergedCount++;
        }

        Database::commit();
    } catch (Throwable $error) {
        if (Database::inTransaction()) {
            Database::rollBack();
        }
        throw $error;
    }

    return ['renamed' => $renamed, 'merged' => $mergedCount, 'aliases' => $aliasesTouched];
}

function accumul8_entity_family_backfill_aliases_from_records(): int
{
    $aliasCount = 0;

    $transactions = Database::queryAll(
        'SELECT owner_user_id, entity_id, description
         FROM accumul8_transactions
         WHERE entity_id IS NOT NULL AND entity_id > 0
         ORDER BY owner_user_id ASC, id ASC'
    );
    foreach ($transactions as $row) {
        $result = accumul8_entity_family_assign_alias(
            (int)($row['owner_user_id'] ?? 0),
            (int)($row['entity_id'] ?? 0),
            (string)($row['description'] ?? '')
        );
        if (in_array($result, ['created', 'updated', 'reassigned'], true)) {
            $aliasCount++;
        }
    }

    $recurringRows = Database::queryAll(
        'SELECT owner_user_id, entity_id, title
         FROM accumul8_recurring_payments
         WHERE entity_id IS NOT NULL AND entity_id > 0
         ORDER BY owner_user_id ASC, id ASC'
    );
    foreach ($recurringRows as $row) {
        $result = accumul8_entity_family_assign_alias(
            (int)($row['owner_user_id'] ?? 0),
            (int)($row['entity_id'] ?? 0),
            (string)($row['title'] ?? '')
        );
        if (in_array($result, ['created', 'updated', 'reassigned'], true)) {
            $aliasCount++;
        }
    }

    return $aliasCount;
}

function accumul8_entity_family_parent_map(): array
{
    $map = [];
    $rows = Database::queryAll(
        'SELECT owner_user_id, id, display_name
         FROM accumul8_entities
         ORDER BY owner_user_id ASC, id ASC'
    );
    foreach ($rows as $row) {
        $ownerUserId = (int)($row['owner_user_id'] ?? 0);
        $displayName = (string)($row['display_name'] ?? '');
        if ($ownerUserId <= 0 || $displayName === '') {
            continue;
        }
        $map[$ownerUserId][$displayName] = (int)($row['id'] ?? 0);
    }
    return $map;
}

function accumul8_entity_family_relink_records(array $parentMap): int
{
    $updated = 0;

    $transactions = Database::queryAll(
        'SELECT id, owner_user_id, entity_id, description
         FROM accumul8_transactions
         ORDER BY owner_user_id ASC, id ASC'
    );
    foreach ($transactions as $row) {
        $family = accumul8_find_entity_family_definition((string)($row['description'] ?? ''));
        if (!is_array($family)) {
            continue;
        }
        $ownerUserId = (int)($row['owner_user_id'] ?? 0);
        $targetId = (int)($parentMap[$ownerUserId][(string)($family['parent_name'] ?? '')] ?? 0);
        if ($targetId <= 0 || $targetId === (int)($row['entity_id'] ?? 0)) {
            continue;
        }
        Database::execute(
            'UPDATE accumul8_transactions
             SET entity_id = ?
             WHERE id = ? AND owner_user_id = ?',
            [$targetId, (int)($row['id'] ?? 0), $ownerUserId]
        );
        $updated++;
    }

    $recurringRows = Database::queryAll(
        'SELECT id, owner_user_id, entity_id, title
         FROM accumul8_recurring_payments
         ORDER BY owner_user_id ASC, id ASC'
    );
    foreach ($recurringRows as $row) {
        $family = accumul8_find_entity_family_definition((string)($row['title'] ?? ''));
        if (!is_array($family)) {
            continue;
        }
        $ownerUserId = (int)($row['owner_user_id'] ?? 0);
        $targetId = (int)($parentMap[$ownerUserId][(string)($family['parent_name'] ?? '')] ?? 0);
        if ($targetId <= 0 || $targetId === (int)($row['entity_id'] ?? 0)) {
            continue;
        }
        Database::execute(
            'UPDATE accumul8_recurring_payments
             SET entity_id = ?
             WHERE id = ? AND owner_user_id = ?',
            [$targetId, (int)($row['id'] ?? 0), $ownerUserId]
        );
        $updated++;
    }

    foreach ($parentMap as $ownerUserId => $ownersParents) {
        foreach ($ownersParents as $parentName => $entityId) {
            $family = accumul8_find_entity_family_definition((string)$parentName);
            if (!is_array($family)) {
                continue;
            }
            Database::execute(
                'UPDATE accumul8_entity_aliases
                 SET entity_id = ?
                 WHERE owner_user_id = ? AND alias_key = ?',
                [(int)$entityId, (int)$ownerUserId, accumul8_entity_match_key($parentName)]
            );
        }
    }

    return $updated;
}

$entities = Database::queryAll(
    'SELECT id, owner_user_id, display_name
     FROM accumul8_entities
     ORDER BY owner_user_id ASC, id ASC'
);

$groups = [];
foreach ($entities as $entity) {
    $ownerUserId = (int)($entity['owner_user_id'] ?? 0);
    $family = accumul8_find_entity_family_definition((string)($entity['display_name'] ?? ''));
    if ($ownerUserId <= 0 || !is_array($family)) {
        continue;
    }
    $parentName = trim((string)($family['parent_name'] ?? ''));
    if ($parentName === '') {
        continue;
    }
    if (!isset($groups[$ownerUserId])) {
        $groups[$ownerUserId] = [];
    }
    if (!isset($groups[$ownerUserId][$parentName])) {
        $groups[$ownerUserId][$parentName] = [];
    }
    $groups[$ownerUserId][$parentName][] = $entity;
}

$summary = ['groups' => 0, 'renamed' => 0, 'merged' => 0, 'aliases' => 0];

foreach ($groups as $ownerUserId => $ownerGroups) {
    foreach ($ownerGroups as $parentName => $rows) {
        if (count($rows) === 0) {
            continue;
        }
        $result = accumul8_entity_family_merge_group((int)$ownerUserId, (string)$parentName, $rows);
        $summary['groups']++;
        $summary['renamed'] += (int)($result['renamed'] ?? 0);
        $summary['merged'] += (int)($result['merged'] ?? 0);
        $summary['aliases'] += (int)($result['aliases'] ?? 0);
        echo 'owner=' . $ownerUserId
            . ' parent="' . $parentName . '"'
            . ' renamed=' . (int)($result['renamed'] ?? 0)
            . ' merged=' . (int)($result['merged'] ?? 0)
            . ' aliases=' . (int)($result['aliases'] ?? 0)
            . PHP_EOL;
    }
}

$parentMap = accumul8_entity_family_parent_map();
$summary['merged'] += accumul8_entity_family_relink_records($parentMap);
$summary['aliases'] += accumul8_entity_family_backfill_aliases_from_records();

echo 'done groups=' . $summary['groups']
    . ' renamed=' . $summary['renamed']
    . ' merged=' . $summary['merged']
    . ' aliases=' . $summary['aliases']
    . PHP_EOL;
