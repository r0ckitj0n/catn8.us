<?php

declare(strict_types=1);

require_once __DIR__ . '/vite_helper.php';

function catn8_render_react_shell(string $page, string $title): void
{
    $page = trim($page);
    if ($page === '') {
        $page = 'home';
    }

    header('Content-Type: text/html; charset=UTF-8');

    echo "<!DOCTYPE html>\n";
    echo "<html lang=\"en\">\n";
    echo "<head>\n";
    echo "  <meta charset=\"UTF-8\">\n";
    echo "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n";
    echo "  <title>" . htmlspecialchars($title) . "</title>\n";
    echo "  <link rel=\"stylesheet\" href=\"/api/appearance.css.php\">\n";
    echo "  <link href=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css\" rel=\"stylesheet\">\n";
    echo "  <link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css\">\n";
    echo "  <link rel=\"stylesheet\" href=\"https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.css\">\n";
    echo "  <link href=\"https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&display=swap\" rel=\"stylesheet\">\n";
    echo "  <script defer src=\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js\"></script>\n";
    vite_entry('src/entries/app.tsx');
    echo "</head>\n";
    $bodyClass = '';
    if ($page === 'mystery' || $page === 'sheriff_station') {
        $bodyClass = 'catn8-noir-mode';
    }

    echo "<body class=\"$bodyClass\">\n";
    echo "  <div id=\"catn8-app\" data-page=\"" . htmlspecialchars($page) . "\"></div>\n";
    echo "  <script src=\"https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.js\"></script>\n";
    echo "  <script>try{AOS.init({duration:1000,once:true});}catch(e){};</script>\n";
    echo "</body>\n";
    echo "</html>\n";
}
