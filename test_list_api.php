<?php

declare(strict_types=1);

// Intentionally disabled: this local test script previously forced admin context.
http_response_code(404);
header('Content-Type: text/plain; charset=UTF-8');
echo "Not found\n";
exit;
