<?php
require 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$openai = OpenAI::client($_ENV['OPENAI_API_KEY']);

// Images to generate for the homepage
$images = [
    'homepage_friends.jpg' => [
        'prompt' => 'A group of diverse children playing together in a colorful playground, showing friendship and joy',
        'style' => 'vivid'
    ],
    'homepage_kindness.jpg' => [
        'prompt' => 'Children helping each other and sharing toys, showing acts of kindness in a bright, cheerful setting',
        'style' => 'vivid'
    ],
    'homepage_growth.jpg' => [
        'prompt' => 'Children learning and growing together, with plants and books, in a warm, nurturing environment',
        'style' => 'vivid'
    ],
    'homepage_family.jpg' => [
        'prompt' => 'A happy family having fun together, playing games and laughing, in a cozy home setting',
        'style' => 'vivid'
    ],
    'homepage_adventure.jpg' => [
        'prompt' => 'Children on an exciting adventure, exploring and discovering new things together',
        'style' => 'vivid'
    ]
];

foreach ($images as $filename => $config) {
    echo "Generating $filename...\n";
    
    try {
        $response = $openai->images()->create([
            'model' => 'dall-e-3',
            'prompt' => $config['prompt'],
            'n' => 1,
            'size' => '1024x1024',
            'style' => $config['style'],
            'quality' => 'standard'
        ]);

        $imageUrl = $response->data[0]->url;
        
        // Download and save the image
        $imageData = file_get_contents($imageUrl);
        if ($imageData === false) {
            throw new Exception("Failed to download image");
        }
        
        if (file_put_contents("images/$filename", $imageData) === false) {
            throw new Exception("Failed to save image");
        }
        
        echo "Successfully generated and saved $filename\n";
        
    } catch (Exception $e) {
        echo "Error generating $filename: " . $e->getMessage() . "\n";
    }
    
    // Add a small delay between requests
    sleep(1);
}

echo "Image generation complete!\n"; 