<?php

require_once __DIR__ . '/../api/config.php';

function secret_db()
{
    return Database::getInstance();
}

function secret_table_ensure($pdo)
{
    Database::execute("CREATE TABLE IF NOT EXISTS secrets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        `key` VARCHAR(191) NOT NULL UNIQUE,
        value_enc LONGBLOB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function secret_key_path()
{
    return __DIR__ . '/../config/secret.key';
}

function secret_load_key()
{
    $path = secret_key_path();
    if (!is_file($path)) {
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        $key = random_bytes(32);
        file_put_contents($path, $key);
        @chmod($path, 0600);
        return $key;
    }
    return file_get_contents($path);
}

function secret_encrypt($plaintext)
{
    $key = secret_load_key();
    if (function_exists('sodium_crypto_secretbox')) {
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $cipher = sodium_crypto_secretbox($plaintext, $nonce, $key);
        return base64_encode($nonce . $cipher);
    }
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return base64_encode($iv . $tag . $cipher);
}

function secret_decrypt($encoded)
{
    $key = secret_load_key();
    $raw = base64_decode($encoded, true);
    if ($raw === false) {
        return null;
    }
    if (function_exists('sodium_crypto_secretbox_open')) {
        $nonceLen = SODIUM_CRYPTO_SECRETBOX_NONCEBYTES;
        if (strlen($raw) < $nonceLen) {
            return null;
        }
        $nonce = substr($raw, 0, $nonceLen);
        $cipher = substr($raw, $nonceLen);
        $plain = @sodium_crypto_secretbox_open($cipher, $nonce, $key);
        return $plain === false ? null : $plain;
    }
    if (strlen($raw) < 28) {
        return null;
    }
    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $cipher = substr($raw, 28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return $plain === false ? null : $plain;
}

function secret_get($key)
{
    try {
        $pdo = secret_db();
        secret_table_ensure($pdo);
        $row = Database::queryOne('SELECT value_enc FROM secrets WHERE `key` = ?', [$key]);
        $enc = $row ? $row['value_enc'] : false;
        if ($enc === false) {
            return null;
        }
        return secret_decrypt($enc);
    } catch (Exception $e) {
        error_log('secret_get error: ' . $e->getMessage());
        return null;
    }
}

function secret_set($key, $value)
{
    try {
        $pdo = secret_db();
        secret_table_ensure($pdo);
        $enc = secret_encrypt((string)$value);
        $affected = Database::execute('INSERT INTO secrets (`key`, value_enc) VALUES (?, ?) ON DUPLICATE KEY UPDATE value_enc = VALUES(value_enc), updated_at = CURRENT_TIMESTAMP', [$key, $enc]);
        return $affected !== false;
    } catch (Exception $e) {
        error_log('secret_set error: ' . $e->getMessage());
        return false;
    }
}

function secret_has($key)
{
    try {
        $pdo = secret_db();
        secret_table_ensure($pdo);
        $row = Database::queryOne('SELECT 1 AS c FROM secrets WHERE `key` = ?', [$key]);
        return $row ? true : false;
    } catch (Exception $e) {
        return false;
    }
}

function secret_delete($key)
{
    try {
        $pdo = secret_db();
        secret_table_ensure($pdo);
        $affected = Database::execute('DELETE FROM secrets WHERE `key` = ?', [$key]);
        return $affected !== false;
    } catch (Exception $e) {
        return false;
    }
}
