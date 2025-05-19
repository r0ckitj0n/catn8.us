<?php
require 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$openai = OpenAI::client($_ENV['OPENAI_API_KEY']);

$images = [
    [
        'prompt' => "A warm and inviting family scene with parents and children playing together in a cozy living room, soft lighting, warm colors, children's artwork on the walls, family photos, and a sense of togetherness. The style should be child-friendly and heartwarming.",
        'filename' => 'about_family.jpg'
    ],
    [
        'prompt' => "A diverse group of families and children gathered in a community center or park, sharing activities, playing games, and helping each other. The scene should show connection, friendship, and community spirit in a bright, cheerful setting.",
        'filename' => 'about_community.jpg'
    ],
    [
        'prompt' => "A heartwarming scene showing children and adults learning and growing together, perhaps in a garden or classroom setting, with plants, books, and educational materials. The image should convey the joy of learning and personal development.",
        'filename' => 'about_growth.jpg'
    ]
];

foreach ($images as $image) {
    try {
        $response = $openai->images()->create([
            'model' => 'dall-e-3',
            'prompt' => $image['prompt'],
            'n' => 1,
            'size' => '1024x1024',
            'quality' => 'standard',
            'style' => 'natural'
        ]);

        $imageUrl = $response->data[0]->url;
        $imageData = file_get_contents($imageUrl);
        file_put_contents('images/' . $image['filename'], $imageData);
        
        echo "Generated {$image['filename']} successfully!\n";
    } catch (Exception $e) {
        echo "Error generating {$image['filename']}: " . $e->getMessage() . "\n";
    }
} 