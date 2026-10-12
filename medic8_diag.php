<?php
declare(strict_types=1);
require_once __DIR__ . "/bootstrap.php";
$expected = trim((string)catn8_env("CATN8_ADMIN_TOKEN", ""));
$got = trim((string)($_GET["admin_token"] ?? ""));
if ($expected === "" || $got === "" || !hash_equals($expected, $got)) {
    catn8_json_response(["success" => false, "error" => "Invalid admin token"], 403);
}
try {
    require_once __DIR__ . "/../includes/medic8_model.php";
    Medic8Model::ensureSchema();
    $tables = Database::queryAll("SHOW TABLES LIKE "medic8_%"");
    catn8_json_response(["success" => true, "tables" => array_map(fn($r) => array_values($r)[0], $tables)]);
} catch (Throwable $e) {
    catn8_json_response(["success" => false, "error" => $e->getMessage(), "type" => get_class($e)], 500);
}
