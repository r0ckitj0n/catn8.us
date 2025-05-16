<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h2>File Permission Check</h2>";

// Check data directory
$dataDir = __DIR__ . '/data';
echo "<p>Data directory ($dataDir): " . (is_readable($dataDir) ? 'Readable' : 'Not readable') . "</p>";
echo "<p>Data directory permissions: " . substr(sprintf('%o', fileperms($dataDir)), -4) . "</p>";

// Check users directory
$usersDir = $dataDir . '/users';
echo "<p>Users directory ($usersDir): " . (is_readable($usersDir) ? 'Readable' : 'Not readable') . "</p>";
echo "<p>Users directory permissions: " . substr(sprintf('%o', fileperms($usersDir)), -4) . "</p>";

// Check admin.json file
$adminFile = $usersDir . '/admin.json';
echo "<p>Admin file ($adminFile): " . (is_readable($adminFile) ? 'Readable' : 'Not readable') . "</p>";
echo "<p>Admin file permissions: " . substr(sprintf('%o', fileperms($adminFile)), -4) . "</p>";

// Try to read the admin file
$users = json_decode(file_get_contents($adminFile), true);
echo "<p>Admin file contents readable: " . ($users !== null ? 'Yes' : 'No') . "</p>";

// Check web server user
echo "<p>Web server user: " . get_current_user() . "</p>";
?> 