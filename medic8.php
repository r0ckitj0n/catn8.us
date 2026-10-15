<?php
declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';
require_once __DIR__ . '/includes/medic8_model.php';

$uid = catn8_auth_user_id();
$requestPath = (string)(parse_url((string)($_SERVER['REQUEST_URI'] ?? '/medic8'), PHP_URL_PATH) ?: '/medic8');
$isMedList = (bool)preg_match('#/medic8/med-list/?$#i', $requestPath);

if ($uid === null) {
    $redirect = $isMedList
        ? '/medic8/med-list' . (isset($_GET['person_id']) ? ('?person_id=' . rawurlencode((string)$_GET['person_id'])) : '')
        : '/medic8/';
    header('Location: ' . catn8_login_redirect_url($redirect));
    exit;
}

catn8_groups_seed_core();
if (!catn8_user_is_admin($uid) && !catn8_user_in_group($uid, 'medic8-users')) {
    header('Location: /');
    exit;
}

Medic8Model::ensureSchema();

if ($isMedList) {
    $personId = (int)($_GET['person_id'] ?? 0);
    if ($personId <= 0 && Medic8Model::isSiteAdmin($uid)) {
        $person = Medic8Model::ensureAdminPerson($uid, 'Jon Graves');
        $personId = (int)($person['id'] ?? 0);
    }
    if ($personId <= 0) {
        $people = Medic8Model::listAccessiblePeople($uid);
        $personId = (int)(($people[0]['id'] ?? 0));
    }
    if ($personId <= 0) {
        http_response_code(400);
        header('Content-Type: text/plain; charset=UTF-8');
        echo "person_id required\n";
        exit;
    }
    try {
        Medic8Model::audit($uid, 'view_med_list', 'medic8_people', $personId, $personId, null, null);
        // Do not log clinical contents.
        header('Content-Type: text/html; charset=UTF-8');
        header('Cache-Control: no-store');
        echo Medic8Model::medicationListHtml($uid, $personId, true);
    } catch (RuntimeException $e) {
        $code = $e->getMessage() === 'Not authorized' ? 403 : 400;
        http_response_code($code);
        header('Content-Type: text/plain; charset=UTF-8');
        echo $e->getMessage() . "\n";
    } catch (Throwable $e) {
        catn8_log_error('medic8 med-list page error', ['error' => $e->getMessage()]);
        http_response_code(500);
        header('Content-Type: text/plain; charset=UTF-8');
        echo "Server error\n";
    }
    exit;
}

header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/index.html');
