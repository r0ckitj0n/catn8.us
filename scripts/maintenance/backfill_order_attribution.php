<?php
// Backfill order_attribution using analytics data (best-effort)
// Usage: php scripts/maintenance/backfill_order_attribution.php [--days=90] [--dry-run=1]

require_once dirname(__DIR__, 2) . '/api/config.php';

function argval($name, $default = null) {
    foreach ($GLOBALS['argv'] ?? [] as $arg) {
        if (strpos($arg, "--{$name}=") === 0) {
            return substr($arg, strlen($name) + 3);
        }
    }
    return $default;
}

$days = (int) (argval('days', 90));
$dryRun = (bool) ((int) argval('dry-run', 0));

try { Database::getInstance(); } catch (Throwable $e) { fwrite(STDERR, "DB connect failed: ".$e->getMessage()."\n"); exit(1);} 

$orders = Database::queryAll(
    "SELECT o.id, o.userId, o.total, o.`date`
     FROM orders o
     LEFT JOIN order_attribution oa ON BINARY oa.order_id = BINARY o.id
     WHERE o.`date` >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND oa.order_id IS NULL
     ORDER BY o.`date` DESC",
    [$days]
);

$total = count($orders);
$updated = 0; $skipped = 0; $errors = 0;

foreach ($orders as $o) {
    $orderId = (string)$o['id'];
    $orderDate = (string)$o['date'];
    $orderTotal = (float)$o['total'];

    try {
        // 1) Prefer explicit checkout_complete interaction around order date
        $row = Database::queryOne(
            "SELECT session_id FROM user_interactions 
             WHERE interaction_type = 'checkout_complete' 
               AND `timestamp` BETWEEN DATE_SUB(?, INTERVAL 2 HOUR) AND DATE_ADD(?, INTERVAL 2 HOUR)
             ORDER BY ABS(TIMESTAMPDIFF(SECOND, `timestamp`, ?)) ASC
             LIMIT 1",
            [$orderDate, $orderDate, $orderDate]
        );
        $sid = $row['session_id'] ?? '';

        // 2) Fallback to page views around order date for checkout/payment/receipt paths
        if (!$sid) {
            $pv = Database::queryOne(
                "SELECT session_id, viewed_at FROM page_views
                 WHERE viewed_at BETWEEN DATE_SUB(?, INTERVAL 2 HOUR) AND DATE_ADD(?, INTERVAL 2 HOUR)
                   AND (page_url LIKE ? OR page_url LIKE ? OR page_url LIKE ?)
                 ORDER BY ABS(TIMESTAMPDIFF(SECOND, viewed_at, ?)) ASC
                 LIMIT 1",
                [$orderDate, $orderDate, '%checkout%', '%payment%', '%receipt%', $orderDate]
            );
            $sid = $pv['session_id'] ?? '';
        }

        if (!$sid) { $skipped++; continue; }

        $sess = Database::queryOne("SELECT utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer FROM analytics_sessions WHERE session_id = ?", [$sid]);
        if (!$sess) { $skipped++; continue; }

        $utm_source = (string)($sess['utm_source'] ?? '');
        $utm_medium = (string)($sess['utm_medium'] ?? '');
        $utm_campaign = (string)($sess['utm_campaign'] ?? '');
        $utm_term = (string)($sess['utm_term'] ?? '');
        $utm_content = (string)($sess['utm_content'] ?? '');
        $ref = (string)($sess['referrer'] ?? '');

        $channel = strtolower(trim($utm_source));
        if ($channel === '') {
            $h = '';
            if ($ref !== '') {
                $h = parse_url($ref, PHP_URL_HOST);
                if (!$h && strpos($ref, '://') === false) {
                    $h = trim(explode('/', $ref)[0] ?? '');
                }
            }
            $h = strtolower((string)$h);
            if (strpos($h, 'www.') === 0) { $h = substr($h, 4); }
            $channel = $h ?: 'direct';
        }

        if ($dryRun) {
            echo "Would attribute order {$orderId} => session {$sid}, channel {$channel}\n";
            $updated++;
            continue;
        }

        Database::execute(
            "INSERT INTO order_attribution (order_id, session_id, channel, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, revenue)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE revenue = VALUES(revenue), channel = VALUES(channel)",
            [$orderId, $sid, $channel, $utm_source, $utm_medium, $utm_campaign, $utm_term, $utm_content, $ref, $orderTotal]
        );
        $updated++;
    } catch (Throwable $e) {
        $errors++;
        fwrite(STDERR, "Backfill failed for order {$orderId}: ".$e->getMessage()."\n");
    }
}

echo json_encode([
    'success' => true,
    'orders_considered' => $total,
    'attributions_added' => $updated,
    'skipped' => $skipped,
    'errors' => $errors,
    'days' => $days,
    'dry_run' => $dryRun,
], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT) . "\n";
