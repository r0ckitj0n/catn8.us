<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/bootstrap.php';
require_once __DIR__ . '/../../includes/valid8_vault_entry_model.php';

/**
 * VALID8 metadata normalizer
 *
 * - Moves name-like category values into owner_name when owner is unassigned.
 * - Assigns a logical category to every entry.
 * - Fills missing URL values when they can be inferred.
 *
 * Usage:
 *   php scripts/maintenance/normalize_valid8_vault_metadata.php --user-uuid=<uuid> [--db-profile=local|live] [--apply]
 *   php scripts/maintenance/normalize_valid8_vault_metadata.php --user-id=<id> [--db-profile=local|live] [--apply]
 */

$options = [
    'user_id' => 0,
    'user_uuid' => '',
    'db_profile' => 'local',
    'apply' => false,
];

foreach (array_slice($argv, 1) as $arg) {
    if (strpos($arg, '--user-id=') === 0) {
        $options['user_id'] = (int)trim(substr($arg, 10));
    } elseif (strpos($arg, '--user-uuid=') === 0) {
        $options['user_uuid'] = trim(substr($arg, 12));
    } elseif (strpos($arg, '--db-profile=') === 0) {
        $options['db_profile'] = strtolower(trim(substr($arg, 13)));
    } elseif ($arg === '--apply') {
        $options['apply'] = true;
    }
}

if ($options['db_profile'] === 'live') {
    $map = [
        'CATN8_DB_LOCAL_HOST' => 'CATN8_DB_LIVE_HOST',
        'CATN8_DB_LOCAL_NAME' => 'CATN8_DB_LIVE_NAME',
        'CATN8_DB_LOCAL_USER' => 'CATN8_DB_LIVE_USER',
        'CATN8_DB_LOCAL_PASS' => 'CATN8_DB_LIVE_PASS',
        'CATN8_DB_LOCAL_PORT' => 'CATN8_DB_LIVE_PORT',
        'CATN8_DB_LOCAL_SOCKET' => 'CATN8_DB_LIVE_SOCKET',
    ];
    foreach ($map as $local => $live) {
        $value = getenv($live);
        if ($value !== false) {
            putenv($local . '=' . $value);
            $_ENV[$local] = $value;
            $_SERVER[$local] = $value;
        }
    }
}

Valid8VaultEntryModel::ensureSchema();

$userUuid = trim((string)$options['user_uuid']);
if ($userUuid === '') {
    $userId = (int)$options['user_id'];
    if ($userId <= 0) {
        fwrite(STDERR, "Provide --user-id=<int> or --user-uuid=<uuid>\n");
        exit(1);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($userId);
}

if (!preg_match('/^[a-f0-9-]{36}$/', strtolower($userUuid))) {
    fwrite(STDERR, "Invalid user UUID\n");
    exit(1);
}

function norm_space(string $value): string
{
    $value = trim($value);
    $value = preg_replace('/\s+/', ' ', $value) ?? '';
    return trim($value);
}

function norm_key(string $value): string
{
    $value = strtolower(norm_space($value));
    $value = str_replace(['+', '&', '/', '\\', '.', ',', ':', ';', '-', '(', ')', '[', ']', '\'', '"'], ' ', $value);
    $value = preg_replace('/\s+/', ' ', $value) ?? '';
    return trim($value);
}

function is_unassigned_owner(string $owner): bool
{
    $k = norm_key($owner);
    return $k === '' || $k === 'unassigned' || $k === 'unknown' || $k === 'n a';
}

function looks_like_person_name(string $category): bool
{
    $raw = norm_space($category);
    if ($raw === '') {
        return false;
    }
    $k = norm_key($raw);
    if ($k === '') {
        return false;
    }

    $blocked = [
        'imported', 'general', 'personal', 'work', 'school', 'education', 'finance', 'financial',
        'banking', 'health', 'medical', 'utilities', 'travel', 'shopping', 'social', 'entertainment',
        'streaming', 'productivity', 'security', 'government', 'insurance', 'email', 'identity',
        'business', 'other', 'misc', 'miscellaneous', 'home',
    ];
    if (in_array($k, $blocked, true)) {
        return false;
    }
    if (preg_match('/\d/', $raw)) {
        return false;
    }
    if (strlen($raw) > 40) {
        return false;
    }

    // Accept single or double word alphabetic names.
    if (preg_match('/^[A-Za-z][A-Za-z\'\-]{1,24}(?:\s+[A-Za-z][A-Za-z\'\-]{1,24})?$/', $raw)) {
        return true;
    }
    return false;
}

function canonical_url_or_null(?string $url): ?string
{
    $u = norm_space((string)$url);
    if ($u === '') {
        return null;
    }
    if (!preg_match('#^https?://#i', $u)) {
        if (preg_match('/^[^\s]+\.[^\s]+$/', $u)) {
            $u = 'https://' . $u;
        }
    }
    if (filter_var($u, FILTER_VALIDATE_URL) === false) {
        return null;
    }
    return $u;
}

function infer_url_from_title(string $title, string $username): ?string
{
    $k = norm_key($title);
    if ($k === '') {
        return null;
    }

    $exact = [
        '1 1 ftp' => 'https://my.ionos.com',
        'acdsee' => 'https://www.acdsee.com',
        'adp benefits enrollment' => 'https://my.adp.com',
        'airtran' => 'https://www.southwest.com',
        'apple id' => 'https://appleid.apple.com',
        'appleid' => 'https://appleid.apple.com',
        'benefits ga breeze' => 'https://www.gabreeze.ga.gov',
        'capital one' => 'https://www.capitalone.com',
        'capitalone' => 'https://www.capitalone.com',
        'capital one 360' => 'https://www.capitalone.com',
        'capital one 360 sarah' => 'https://www.capitalone.com',
        'capital one spark business' => 'https://www.capitalone.com',
        'cash app' => 'https://cash.app',
        'click ready master account' => 'https://www.clickreadymarketing.com',
        'college board' => 'https://account.collegeboard.org',
        'costco' => 'https://www.costco.com',
        'dacula soccer club' => 'https://www.daculasoccer.com',
        'dds2go' => 'https://dds2go.com',
        'delta airlines' => 'https://www.delta.com',
        'discovery' => 'https://www.discoveryplus.com',
        'discovery +' => 'https://www.discoveryplus.com',
        'disney' => 'https://www.disneyplus.com',
        'disney +' => 'https://www.disneyplus.com',
        'docusign' => 'https://account.docusign.com',
        'duolingo' => 'https://www.duolingo.com',
        'employee self service' => 'https://my.adp.com',
        'firefox sync' => 'https://accounts.firefox.com',
        'fafsa' => 'https://studentaid.gov',
        'fedex' => 'https://www.fedex.com',
        'follow my health' => 'https://www.followmyhealth.com',
        'google' => 'https://accounts.google.com',
        'google mariah' => 'https://accounts.google.com',
        'google picasa' => 'https://accounts.google.com',
        'google trinity' => 'https://accounts.google.com',
        'google mail' => 'https://mail.google.com',
        'google mail 2' => 'https://mail.google.com',
        'gsu' => 'https://www.gsu.edu',
        'gsu email' => 'https://mail.gsu.edu',
        'hbo max' => 'https://www.max.com',
        'hero' => 'https://www.herodev.com',
        'intuit id' => 'https://accounts.intuit.com',
        'itunes' => 'https://appleid.apple.com',
        'jon wireless network' => 'http://192.168.1.1',
        'lightspeed mobile filtering' => 'https://www.lightspeedsystems.com',
        'live family safety' => 'https://account.microsoft.com/family',
        'macbook' => 'https://www.icloud.com',
        'microsoft live' => 'https://account.microsoft.com',
        'microsoft passport' => 'https://account.microsoft.com',
        'pandora' => 'https://www.pandora.com',
        'paramount essentials' => 'https://www.paramountplus.com',
        'paramount + essentials' => 'https://www.paramountplus.com',
        'prospect mortgage' => 'https://www.prospectmortgage.com',
        'quicken id' => 'https://www.quicken.com',
        'rcb ssh for prosys' => 'https://prosys.com',
        'social security' => 'https://www.ssa.gov/myaccount',
        'southeast toyota finance' => 'https://www.southeasttoyotafinance.com',
        'state farm' => 'https://www.statefarm.com',
        'suntrust' => 'https://www.truist.com',
        'ung' => 'https://www.ung.edu',
        'ups' => 'https://www.ups.com',
        'us airways' => 'https://www.aa.com',
        'usaa' => 'https://www.usaa.com',
        'usps' => 'https://www.usps.com',
        'vuze to' => 'https://www.vuze.com',
        'walton county water department' => 'https://www.wcws.com',
        'webull' => 'https://www.webull.com',
        'windows' => 'https://account.microsoft.com',
        'xmarks' => 'https://www.lastpass.com',
        'youversion bible' => 'https://www.bible.com',
    ];
    if (isset($exact[$k])) {
        return $exact[$k];
    }

    if (strpos($k, 'apple') !== false || strpos($k, 'itunes') !== false) {
        return 'https://appleid.apple.com';
    }
    if (strpos($k, 'google') !== false || strpos($k, 'gmail') !== false) {
        return 'https://accounts.google.com';
    }
    if (strpos($k, 'microsoft') !== false || strpos($k, 'windows') !== false || strpos($k, 'live') !== false) {
        return 'https://account.microsoft.com';
    }
    if (strpos($k, 'capital one') !== false || strpos($k, 'capitalone') !== false) {
        return 'https://www.capitalone.com';
    }
    if (strpos($k, 'delta') !== false || strpos($k, 'airways') !== false || strpos($k, 'airtran') !== false) {
        return 'https://www.delta.com';
    }

    // Last resort: use email domain when it looks plausible for web login.
    if (preg_match('/@([a-z0-9.-]+\.[a-z]{2,})$/i', trim($username), $m)) {
        $domain = strtolower($m[1]);
        if ($domain !== '' && strpos($domain, 'gmail.com') === false && strpos($domain, 'outlook.com') === false && strpos($domain, 'hotmail.com') === false) {
            return 'https://' . $domain;
        }
    }

    return null;
}

function infer_category(string $title, ?string $url, string $sourceTab): string
{
    $kTitle = norm_key($title);
    $kTab = norm_key($sourceTab);
    $u = canonical_url_or_null($url);
    $host = '';
    if ($u !== null) {
        $parsedHost = parse_url($u, PHP_URL_HOST);
        $host = strtolower((string)$parsedHost);
        $host = preg_replace('/^www\./', '', $host) ?? $host;
    }

    $haystack = trim($kTitle . ' ' . $host . ' ' . $kTab);

    $has = static function (array $tokens) use ($haystack): bool {
        foreach ($tokens as $t) {
            if ($t !== '' && strpos($haystack, $t) !== false) {
                return true;
            }
        }
        return false;
    };

    if ($has([
        'bank', 'capitalone', 'capital one', 'usaa', 'suntrust', 'truist', 'bbt', '53.com',
        'creditkarma', 'equifax', 'webull', 'cash app', 'paypal', 'mint', 'intuit', 'quicken',
        'wageworks', 'loanadministration', 'mortgage', 'finance', 'syf.com', 'peachstatefcu',
    ])) {
        return 'Finance';
    }
    if ($has(['state farm', 'insurance'])) {
        return 'Insurance';
    }
    if ($has([
        'gmail', 'google', 'appleid', 'apple id', 'itunes', 'microsoft', 'passport', 'live.com', 'outlook',
        'hotmail', 'yahoo', 'mail.', 'comcast.net',
    ])) {
        return 'Email & Identity';
    }
    if ($has([
        'walton.k12.ga.us', 'cobbk12.org', 'simnetonline.com', 'studyisland', 'timeforkids',
        'onlineproctornow', 'applytexas', 'gacollege411', 'college', 'student',
    ])) {
        return 'Education';
    }
    if ($has([
        'statefarm.com', 'progressive.com', 'hagerty.com', 'legalplans.com', 'prepaidlegal.com',
        'rocketlawyer.com',
    ])) {
        return 'Insurance & Legal';
    }
    if ($has([
        'eventbrite', 'ticketmaster', 'seatadvisor', 'goldstar', 'axs.com', 'ticketalternative',
        'dragoncon', 'acsevents.org', 'relayforlife',
    ])) {
        return 'Events & Tickets';
    }
    if ($has([
        'wordpress', 'wp-login', 'themeforest', 'bluehost', '1and1', 'godaddy', 'github',
        'browserstack', 'crossbrowsertesting', 'logmein', 'teamviewer', 'ifttt', 'mockflow',
        'salesforce.com', 'wordstream', 'chiefarchitect', 'dell.com', 'hp.com',
    ])) {
        return 'Work & Business';
    }
    if ($has([
        'carfax', 'autotrader', 'cycletrader', 'mytraderonline', 'mustangs', 'polaris', 'powersports',
        'boatus', 'corvettemods', 'jeepers',
    ])) {
        return 'Automotive & Boating';
    }
    if ($has([
        'ring.com', 'ringapp', 'straighttalk', 'verizonwireless', 'att.net', 'dish.com', 'metropcs',
        'guestinternet', 'sonicwall', 'vpn.',
    ])) {
        return 'Telecom & Internet';
    }
    if ($has([
        'myezyaccess', 'mychart', 'medco', 'accredo', 'zocdoc', 'sharecare', 'cigna', 'cancer.org',
    ])) {
        return 'Healthcare';
    }
    if ($has([
        'sportsaffinity', 'chess.com', 'fitbit', 'livestrong', 'wodtogether', 'diveraid', 'tdisdi',
        'skype', 'musescore', 'karaoke', 'xda-developers',
    ])) {
        return 'Sports & Hobbies';
    }
    if ($has([
        'airbnb', 'hotels.com', 'royalcaribbean', 'carnival.com', 'vacationowners.net', 'southwest.com',
        'ncl.com', 'flightnetwork',
    ])) {
        return 'Travel';
    }
    if ($has([
        'pinterest', 'twitter.com', 'foursquare.com', 'discord.com', 'community',
    ])) {
        return 'Social';
    }
    if ($has([
        'church', 'fellowship', 'rightnow.org', 'divorcecare',
    ])) {
        return 'Faith & Community';
    }
    if ($has([
        'ajc.com', 'nbc.com', 'experts-exchange', 'wolframalpha',
    ])) {
        return 'News & Information';
    }
    if ($has([
        'mealpay', 'mypaymentsplus', 'accountcentralonline', 'payment',
    ])) {
        return 'Household & Family';
    }
    if ($has([
        'android:', 'chrome://', 'app.', 'accounts.',
    ]) && $has(['robinhood', 'moomoo', 'trade-password'])) {
        return 'Finance';
    }
    if ($has(['facebook', 'linkedin', 'match.com', 'craigslist', 'classmates', 'thecity.org'])) {
        return 'Social';
    }
    if ($has([
        'amazon', 'ebay', 'walmart', 'homedepot', 'costco', 'rei', 'toysrus', 'walgreens',
        'groupon', 'bikebandit', 'boating', 'boats.net', 'sportsauthority', 'alibaba',
        'shutterfly', 'savves', 'freespicerefills', 'industriallubricantstore',
    ])) {
        return 'Shopping & Shipping';
    }
    if ($has(['usps', 'ups', 'fedex', 'shipping'])) {
        return 'Shopping & Shipping';
    }
    if ($has(['delta', 'airways', 'airtran', 'airline', 'travel'])) {
        return 'Travel';
    }
    if ($has(['hotwire', 'tripadvisor', 'booking.com', 'vrbo', 'frontier', 'lastminute', 'rocketmiles', 'roadtrippers'])) {
        return 'Travel';
    }
    if ($has([
        'disney', 'hbo', 'max.com', 'pandora', 'paramount', 'discoveryplus', 'duolingo', 'youversion', 'bible',
        'netflix', 'hulu', 'youtube', 'minecraft', 'fandango', 'tivo', 'karafun', 'singsnap', 'music',
    ])) {
        return 'Entertainment';
    }
    if ($has([
        'gsu', 'ung', 'ggc.edu', 'gpc.edu', 'college board', 'fafsa', '.edu', 'school', 'student',
        'act', 'icivics', 'blackboard', 'brytewave', 'connectmath', 'icollege', 'portal',
    ])) {
        return 'Education';
    }
    if ($has([
        'followmyhealth', 'mychart', 'myuhc', 'bcbsga', 'express-scripts', 'health', 'medical',
        'doctor', 'wellness', 'healthways', 'uhcrewards',
    ])) {
        return 'Healthcare';
    }
    if ($has(['social security', 'dds2go', '.gov', 'gabreeze', 'gtc.dor.ga.gov', 'stateofgeorgia'])) {
        return 'Government';
    }
    if ($has([
        'docusign', 'adp', 'employee self service', 'ssh', 'ftp', 'prosys', 'click ready', 'clickready',
        'lightspeed', 'godaddy', 'github', 'oracle', 'cisco', 'paloalto', 'vmware', 'meraki', 'harvestapp',
        'screamingfrog', 'raventools', 'termius', 'wordpress', 'exinda', 'commvault', 'cameyo',
    ])) {
        return 'Work & Business';
    }
    if ($has([
        'water', 'utility', 'wireless network', 'router', 'gwinnettcounty', 'waltonemc', 'georgia power',
        'paymentus', 'nest.com',
    ])) {
        return 'Utilities';
    }
    if ($has(['macbook', 'windows', 'acdsee', 'xmarks', 'vuze', 'firefox'])) {
        return 'Devices & Software';
    }

    if ($kTitle === '' && $host === '') {
        return 'General';
    }
    return 'Web Accounts';
}

$rows = Valid8VaultEntryModel::listEntries($userUuid, true);
$byId = [];
foreach ($rows as $row) {
    $id = (string)($row['id'] ?? '');
    if ($id !== '') {
        $byId[$id] = $row;
    }
}

$total = count($byId);
$updates = [];
$stats = [
    'move_name_category_to_owner' => 0,
    'category_changed' => 0,
    'url_filled' => 0,
    'rows_changed' => 0,
    'unresolved_missing_url' => 0,
];
$unresolved = [];
$categoryCounts = [];

foreach ($byId as $id => $row) {
    $title = (string)($row['title'] ?? '');
    $ownerOld = norm_space((string)($row['owner_name'] ?? 'Unassigned'));
    $categoryOld = norm_space((string)($row['category'] ?? ''));
    $urlOld = canonical_url_or_null((string)($row['url'] ?? ''));
    $sourceTab = (string)($row['source_tab'] ?? '');

    $ownerNew = $ownerOld === '' ? 'Unassigned' : $ownerOld;
    $categoryForInference = $categoryOld;

    if (looks_like_person_name($categoryOld) && is_unassigned_owner($ownerNew)) {
        $ownerNew = $categoryOld;
        $categoryForInference = '';
        $stats['move_name_category_to_owner']++;
    }

    $secret = null;
    $username = '';
    if ($urlOld === null) {
        $secret = Valid8VaultEntryModel::decryptEntry($row);
        $username = trim((string)($secret['username'] ?? ''));
    }
    $urlInferred = $urlOld ?? canonical_url_or_null(infer_url_from_title($title, $username));
    if ($urlOld === null && $urlInferred === null) {
        $stats['unresolved_missing_url']++;
        $unresolved[] = [
            'id' => $id,
            'title' => $title,
            'owner_name' => $ownerNew,
            'username' => $username,
            'source_tab' => $sourceTab,
        ];
    }

    $categoryNew = infer_category($title, $urlInferred, $sourceTab);
    if ($categoryNew === '') {
        $categoryNew = 'General';
    }

    $categoryCounts[$categoryNew] = ($categoryCounts[$categoryNew] ?? 0) + 1;

    $changed = false;
    if ($ownerNew !== $ownerOld) {
        $changed = true;
    }
    if ($categoryNew !== $categoryOld) {
        $changed = true;
        $stats['category_changed']++;
    }
    if ($urlOld === null && $urlInferred !== null) {
        $changed = true;
        $stats['url_filled']++;
    }

    if ($changed) {
        $stats['rows_changed']++;
        $updates[] = [
            'id' => $id,
            'owner_old' => $ownerOld,
            'owner_new' => $ownerNew,
            'category_old' => $categoryOld,
            'category_new' => $categoryNew,
            'url_old' => $urlOld,
            'url_new' => $urlInferred,
            'source_tab' => $sourceTab,
            'title' => $title,
        ];
    }
}

usort($updates, static fn(array $a, array $b): int => strcmp((string)$a['title'], (string)$b['title']));
ksort($categoryCounts);

$now = gmdate('Ymd_His');
$reportDir = __DIR__ . '/../../.local/state/valid8';
if (!is_dir($reportDir)) {
    @mkdir($reportDir, 0777, true);
}
$reportPath = $reportDir . '/normalize_vault_metadata_' . $now . ($options['apply'] ? '_apply' : '_dry_run') . '.json';

$report = [
    'success' => true,
    'mode' => $options['apply'] ? 'apply' : 'dry_run',
    'db_profile' => $options['db_profile'],
    'user_uuid' => $userUuid,
    'total_rows' => $total,
    'stats' => $stats,
    'category_distribution_after_inference' => $categoryCounts,
    'sample_updates' => array_slice($updates, 0, 100),
    'unresolved_missing_url' => $unresolved,
];
file_put_contents($reportPath, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

if (!$options['apply']) {
    fwrite(STDOUT, json_encode([
        'success' => true,
        'mode' => 'dry_run',
        'report' => $reportPath,
        'summary' => [
            'total_rows' => $total,
            'rows_changed' => $stats['rows_changed'],
            'move_name_category_to_owner' => $stats['move_name_category_to_owner'],
            'category_changed' => $stats['category_changed'],
            'url_filled' => $stats['url_filled'],
            'unresolved_missing_url' => $stats['unresolved_missing_url'],
        ],
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
    exit(0);
}

Database::beginTransaction();
try {
    foreach ($updates as $u) {
        $ownerNew = (string)$u['owner_new'];
        if ($ownerNew === '') {
            $ownerNew = 'Unassigned';
        }
        $categoryNew = (string)$u['category_new'];
        if ($categoryNew === '') {
            $categoryNew = 'General';
        }
        $urlNew = $u['url_new'] !== null ? (string)$u['url_new'] : null;
        $id = (string)$u['id'];

        Database::execute(
            'UPDATE vault_entries
             SET owner_name = ?, category = ?, url = ?
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$ownerNew, $categoryNew, $urlNew, $id, $userUuid]
        );

        // Keep SQL-based fingerprints aligned after owner/url updates.
        Database::execute(
            'UPDATE vault_entries
             SET account_fingerprint = LOWER(SHA2(CONCAT_WS("|", COALESCE(title, ""), COALESCE(url, ""), COALESCE(owner_name, ""), COALESCE(HEX(username_encrypted), "")), 256)),
                 entry_fingerprint = LOWER(SHA2(CONCAT_WS("|", COALESCE(title, ""), COALESCE(url, ""), COALESCE(owner_name, ""), COALESCE(HEX(username_encrypted), ""), COALESCE(HEX(password_encrypted), "")), 256))
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$id, $userUuid]
        );
    }
    Database::commit();
} catch (Throwable $e) {
    if (Database::inTransaction()) {
        Database::rollBack();
    }
    fwrite(STDERR, "Apply failed: " . $e->getMessage() . "\n");
    exit(1);
}

fwrite(STDOUT, json_encode([
    'success' => true,
    'mode' => 'apply',
    'report' => $reportPath,
    'summary' => [
        'total_rows' => $total,
        'rows_changed' => $stats['rows_changed'],
        'move_name_category_to_owner' => $stats['move_name_category_to_owner'],
        'category_changed' => $stats['category_changed'],
        'url_filled' => $stats['url_filled'],
        'unresolved_missing_url' => $stats['unresolved_missing_url'],
    ],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
