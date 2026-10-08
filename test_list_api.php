<?php

declare(strict_types=1);

// Intentionally disabled: this local test harness must never be web-accessible on live.
http_response_code(404);
header('Content-Type: text/plain; charset=UTF-8');
echo "Not found\n";
exit;
