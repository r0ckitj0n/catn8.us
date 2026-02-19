<?php

declare(strict_types=1);

final class Database
{
    private static ?self $instance = null;
    private PDO $pdo;

    private function __construct()
    {
        $cfg = function_exists('catn8_get_db_config') ? catn8_get_db_config('current') : [];
        $isLocal = function_exists('catn8_is_local_request') ? catn8_is_local_request() : false;

        if (!$isLocal) {
            $host = trim((string)($cfg['host'] ?? ''));
            $db = trim((string)($cfg['db'] ?? ''));
            $user = trim((string)($cfg['user'] ?? ''));
            $pass = (string)($cfg['pass'] ?? '');
            $port = (int)($cfg['port'] ?? 3306);
            $socket = trim((string)($cfg['socket'] ?? ''));

            if ($socket === '' && $host === '') {
                throw new RuntimeException('Missing DB config: host (or socket) is required for live database');
            }
            if ($db === '') {
                throw new RuntimeException('Missing DB config: db name is required for live database');
            }
            if ($user === '') {
                throw new RuntimeException('Missing DB config: user is required for live database');
            }
        } else {
            $host = (string)($cfg['host'] ?? getenv('CATN8_DB_LOCAL_HOST') ?: '127.0.0.1');
            $db = (string)($cfg['db'] ?? getenv('CATN8_DB_LOCAL_NAME') ?: 'catn8');
            $user = (string)($cfg['user'] ?? getenv('CATN8_DB_LOCAL_USER') ?: 'root');
            $pass = (string)($cfg['pass'] ?? getenv('CATN8_DB_LOCAL_PASS') ?: '');
            $port = (int)($cfg['port'] ?? (getenv('CATN8_DB_LOCAL_PORT') ?: 3306));
            $socket = (string)($cfg['socket'] ?? getenv('CATN8_DB_LOCAL_SOCKET') ?: '');
        }

        $dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4;connect_timeout=3";
        if ($socket !== '') {
            $dsn = "mysql:unix_socket={$socket};dbname={$db};charset=utf8mb4;connect_timeout=3";
        }

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 3,
        ];

        $this->pdo = new PDO($dsn, $user, $pass, $options);
    }

    public static function getInstance(): PDO
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance->pdo;
    }

    public static function createConnection(
        string $host,
        string $db,
        string $user,
        string $pass,
        int $port = 3306,
        ?string $socket = null,
        array $options = []
    ): PDO {
        $dsn = ($socket !== null && $socket !== '')
            ? "mysql:unix_socket={$socket};dbname={$db};charset=utf8mb4;connect_timeout=3"
            : "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4;connect_timeout=3";

        $defaultOptions = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 3,
        ];

        return new PDO($dsn, $user, $pass, $options + $defaultOptions);
    }

    public static function queryAll(string $sql, array $params = []): array
    {
        $pdo = self::getInstance();
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function queryOne(string $sql, array $params = []): ?array
    {
        $pdo = self::getInstance();
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public static function execute(string $sql, array $params = []): int
    {
        $pdo = self::getInstance();
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public static function lastInsertId(): string
    {
        return self::getInstance()->lastInsertId();
    }

    public static function beginTransaction(): bool
    {
        return self::getInstance()->beginTransaction();
    }

    public static function commit(): bool
    {
        return self::getInstance()->commit();
    }

    public static function rollBack(): bool
    {
        return self::getInstance()->rollBack();
    }

    public static function inTransaction(): bool
    {
        return self::getInstance()->inTransaction();
    }

    private function __clone()
    {
    }

    public function __wakeup()
    {
    }
}
