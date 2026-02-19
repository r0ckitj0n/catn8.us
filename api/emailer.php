<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

function catn8_get_smtp_config_safe(): array
{
    $host = (string)(secret_get(catn8_secret_key('smtp.host')) ?? '');
    $port = (int)(secret_get(catn8_secret_key('smtp.port')) ?? 587);
    $secure = (string)(secret_get(catn8_secret_key('smtp.secure')) ?? 'tls');
    $user = (string)(secret_get(catn8_secret_key('smtp.user')) ?? '');
    $fromEmail = (string)(secret_get(catn8_secret_key('smtp.from_email')) ?? '');
    $fromName = (string)(secret_get(catn8_secret_key('smtp.from_name')) ?? 'catn8.us');

    return [
        'host' => $host,
        'port' => $port,
        'secure' => $secure,
        'user' => $user,
        'from_email' => $fromEmail,
        'from_name' => $fromName,
        'configured' => ($host !== '' && $fromEmail !== ''),
    ];
}

function catn8_smtp_is_configured(): bool
{
    $cfg = catn8_get_smtp_config_safe();
    $pass = (string)(secret_get(catn8_secret_key('smtp.pass')) ?? '');
    return ($cfg['host'] ?? '') !== '' && ($cfg['from_email'] ?? '') !== '' && $pass !== '';
}

function catn8_send_email(string $toEmail, string $toName, string $subject, string $htmlBody): void
{
    if (!class_exists(PHPMailer::class)) {
        throw new RuntimeException('PHPMailer is not installed. Run composer install.');
    }

    $cfg = catn8_get_smtp_config_safe();
    $pass = (string)(secret_get(catn8_secret_key('smtp.pass')) ?? '');

    if (($cfg['host'] ?? '') === '' || ($cfg['from_email'] ?? '') === '' || $pass === '') {
        throw new RuntimeException('SMTP is not configured.');
    }

    $mail = new PHPMailer(true);

    $mail->isSMTP();
    $mail->Host = (string)$cfg['host'];
    $mail->Port = (int)$cfg['port'];
    $mail->SMTPAuth = true;
    $mail->Username = (string)$cfg['user'];
    $mail->Password = $pass;

    $secure = strtolower((string)$cfg['secure']);
    if ($secure === 'ssl') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    } else if ($secure === 'none' || $secure === '') {
        $mail->SMTPSecure = false;
        $mail->SMTPAutoTLS = false;
    } else {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    }

    $mail->setFrom((string)$cfg['from_email'], (string)$cfg['from_name']);
    $mail->addAddress($toEmail, $toName);
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body = $htmlBody;

    $mail->send();
}
