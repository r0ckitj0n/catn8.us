<?php
require_once __DIR__ . '/admin_functions_jobs.php';

if ($action === 'ai_prompt_preview') {
    require __DIR__ . '/admin_actions_jobs_preview.php';
}

if (in_array($action, ['delete_job', 'clear_queue', 'clear_completed_jobs', 'list_jobs', 'enqueue_job'])) {
    require __DIR__ . '/admin_actions_jobs_manage.php';
}
