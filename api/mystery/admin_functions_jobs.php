<?php

/**
 * Fetches names from a master character table for a specific mystery.
 */
function catn8_mystery_fetch_master_names(string $table, int $mysteryId, array $ids): array {
    $mysteryId = (int)$mysteryId;
    if ($mysteryId <= 0) return [];
    $idsClean = [];
    foreach ($ids as $v) {
        $n = (int)$v;
        if ($n > 0) $idsClean[$n] = 1;
    }
    $idsClean = array_keys($idsClean);
    if (!count($idsClean)) return [];

    $in = implode(',', array_fill(0, count($idsClean), '?'));
    $params = array_merge([$mysteryId], $idsClean);
    $rows = Database::queryAll('SELECT id, name FROM ' . $table . ' WHERE mystery_id = ? AND id IN (' . $in . ') AND is_archived = 0', $params);
    $out = [];
    foreach ($rows as $r) {
        $name = trim((string)($r['name'] ?? ''));
        if ($name !== '') $out[] = $name;
    }
    sort($out);
    return $out;
}
