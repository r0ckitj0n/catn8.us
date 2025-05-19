<?php
require 'vendor/autoload.php';
require 'config.php';

use OpenAI\Client;

$client = OpenAI::client($_ENV['OPENAI_API_KEY']);

$prompt = "A colorful Tetris game scene with falling blocks in bright colors, showing a partially completed game board with some completed lines. The scene should be vibrant and engaging, suitable for a game preview image.";

try {
    $response = $client->images()->create([
        'model' => 'dall-e-3',
        'prompt' => $prompt,
        'n' => 1,
        'size' => '1024x1024',
        'quality' => 'standard',
    ]);

    $imageUrl = $response->data[0]->url;
    $imageData = file_get_contents($imageUrl);
    
    if ($imageData === false) {
        throw new Exception("Failed to download image from URL");
    }

    $savePath = 'images/tetris-preview.jpg';
    if (file_put_contents($savePath, $imageData) === false) {
        throw new Exception("Failed to save image to file");
    }

    echo "Tetris preview image generated and saved successfully!\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
} 