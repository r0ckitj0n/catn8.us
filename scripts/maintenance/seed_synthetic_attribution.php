<?php
// Seed synthetic attribution for demo purposes
// Usage: php scripts/maintenance/seed_synthetic_attribution.php [--days=180] [--limit=0]

require_once dirname(__DIR__, 2) . '/api/config.php';

function argval($name, $default = null) {
    foreach (($GLOBALS['argv'] ?? []) as $arg) {
        if (strpos($arg, "--{$name}=") === 0) {
            return substr($arg, strlen($name) + 3);
        }
    }
    return $default;
}

$days = (int) (argval('days', 180));
$limit = (int) (argval('limit', 0));

try { Database::getInstance(); } catch (Throwable $e) { fwrite(STDERR, "DB connect failed: ".$e->getMessage()."\n"); exit(1);} 

$ordersSql = "SELECT o.id, o.userId, o.total, o.`date`
              FROM orders o
              LEFT JOIN order_attribution oa ON BINARY oa.order_id = BINARY o.id
              WHERE o.`date` >= DATE_SUB(NOW(), INTERVAL ? DAY)
                AND oa.order_id IS NULL
              ORDER BY o.`date` DESC";
if ($limit > 0) { $ordersSql .= " LIMIT " . (int)$limit; }
$orders = Database::queryAll($ordersSql, [$days]);

$channels = [
    ['google',           35], // utm
    ['facebook.com',     20], // referrer
    ['instagram.com',    10], // referrer
    ['email',            15], // utm
    ['direct',           10], // none
    ['referral',         10], // referrer from list
];
$campaigns = ['spring_sale','fall_clearance','brand_kw','retargeting','newsletter','promo_code'];
$referrals = ['partner1.com','blog.example.com','pinterest.com','yahoo.com','bing.com'];

$total = count($orders);
$created = 0; $skipped = 0; $errors = 0;

foreach ($orders as $o) {
    $orderId = (string)$o['id'];
    $orderDate = (string)$o['date'];
    $orderTotal = (float)$o['total'];

    // Weighted channel pick
    $roll = rand(1, 100); $sum = 0; $picked = 'direct';
    foreach ($channels as [$name, $weight]) { $sum += $weight; if ($roll <= $sum) { $picked = $name; break; } }

    $utm_source = ''; $utm_medium = ''; $utm_campaign = ''; $utm_term = ''; $utm_content = '';
    $referrer = '';
    $channel = '';

    if ($picked === 'google') {
        $utm_source = 'google';
        $utm_medium = (rand(0, 1) ? 'cpc' : 'organic');
        $utm_campaign = $campaigns[array_rand($campaigns)];
        $channel = 'google';
    } elseif ($picked === 'email') {
        $utm_source = 'email';
        $utm_medium = 'email';
        $utm_campaign = 'newsletter';
        $channel = 'email';
    } elseif ($picked === 'referral') {
        $host = $referrals[array_rand($referrals)];
        $referrer = 'https://' . $host . '/some-article';
        $channel = strtolower($host);
    } elseif ($picked === 'direct') {
        $channel = 'direct';
    } else {
        // social host based
        $host = $picked; // facebook.com / instagram.com
        $referrer = 'https://' . $host . '/post/123';
        $channel = strtolower($host);
    }

    // Synthetic session
    $sid = 'syn_' . $orderId;
    $userAgent = rand(0,1) ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15'
                           : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
    $deviceType = (strpos($userAgent, 'Macintosh') !== false || strpos($userAgent, 'Windows') !== false) ? 'desktop' : 'mobile';
    $browser = (strpos($userAgent, 'Safari') !== false && strpos($userAgent, 'Chrome') === false) ? 'Safari' : 'Chrome';
    $os = strpos($userAgent, 'Macintosh') !== false ? 'macOS' : 'Windows';

    // Place session start before order time
    $startTs = strtotime($orderDate) - rand(300, 7200); // 5m - 2h before
    $started_at = date('Y-m-d H:i:s', $startTs);

    try {
        // Insert or update analytics_sessions
        Database::execute(
            "INSERT INTO analytics_sessions
                (session_id, user_id, ip_address, user_agent, referrer, landing_page,
                 utm_source, utm_medium, utm_campaign, utm_term, utm_content,
                 device_type, browser, operating_system, started_at, last_activity,
                 total_page_views, bounce, converted, conversion_value)
             VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
             ON DUPLICATE KEY UPDATE converted=1, conversion_value=GREATEST(conversion_value, VALUES(conversion_value)), last_activity=VALUES(last_activity)",
            [
                $sid,
                '127.0.0.1',
                $userAgent,
                $referrer,
                '/',
                $utm_source,
                $utm_medium,
                $utm_campaign,
                $utm_term,
                $utm_content,
                $deviceType,
                $browser,
                $os,
                $started_at,
                $orderDate,
                rand(2,6),
                0,
                $orderTotal
            ]
        );

        // Insert order_attribution
        Database::execute(
            "INSERT INTO order_attribution (order_id, session_id, channel, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, revenue)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE revenue=VALUES(revenue), channel=VALUES(channel)",
            [$orderId, $sid, $channel, $utm_source, $utm_medium, $utm_campaign, $utm_term, $utm_content, $referrer, $orderTotal]
        );

        $created++;
    } catch (Throwable $e) {
        $errors++;
        fwrite(STDERR, "Seed failed for order {$orderId}: ".$e->getMessage()."\n");
    }
}

echo json_encode([
    'success' => true,
    'orders_considered' => $total,
    'attributions_created' => $created,
    'skipped' => $skipped,
    'errors' => $errors,
    'days' => $days,
    'limit' => $limit,
], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT) . "\n";
