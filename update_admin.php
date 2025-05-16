<?php
$password = 'Liv3itup!';
$hash = password_hash($password, PASSWORD_DEFAULT);

$adminData = [
    'admin4catn8' => [
        'email' => 'admin@catn8.us',
        'name' => 'Admin',
        'password' => $hash,
        'is_admin' => true,
        'created_at' => date('Y-m-d H:i:s'),
        'description' => 'System Administrator',
        'profile_photo' => 'images/default-profile.jpg'
    ]
];

file_put_contents('data/users/admin.json', json_encode($adminData, JSON_PRETTY_PRINT));
echo "Admin user updated successfully!\n";
echo "Password hash: " . $hash . "\n";
?> 