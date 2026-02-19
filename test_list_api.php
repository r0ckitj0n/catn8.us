<?php
require_once __DIR__ . '/api/bootstrap.php';
$_GET['action'] = 'list_master_characters';
$_GET['mystery_id'] = '5';
$isAdmin = true;
$viewerId = 1; // Assuming 1 is admin
require_once __DIR__ . '/api/mystery/admin.php';
