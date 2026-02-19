<?php
declare(strict_types=1);

$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['HTTP_HOST'] = 'localhost';
$_GET['action'] = 'list_weapons';

// Mock session
session_start();
$_SESSION['catn8_user_id'] = 1; 

try {
    require_once __DIR__ . '/api/mystery/admin.php';
} catch (Throwable $e) {
    echo "\nFATAL ERROR caught in list_weapons repro:\n";
    echo $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
