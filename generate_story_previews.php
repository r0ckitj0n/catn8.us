<?php
require 'vendor/autoload.php';
require_once 'config.php';

use OpenAI\Client;

// Initialize OpenAI client
$client = OpenAI::client($_ENV['OPENAI_API_KEY']);

// Define image prompts for each story
$storyPrompts = [
    'story1' => 'A warm family scene with grandparents and children, magical sparkles floating around them during a loving hug, bright and cheerful atmosphere',
    'story2' => 'A lively kitchen with animated appliances - a dancing blender, a joking toaster, and a singing mixer, creating a fun cooking environment',
    'story3' => 'A magical calendar with friendly eyes, surrounded by acts of kindness like sharing toys and helping others, bright and inviting',
    'story4' => 'A family puzzle coming to life, with pieces representing different family members, showing unity and connection',
    'story5' => 'An enchanted garden where flowers sing and trees dance, with children playing among the musical plants',
    'story6' => 'A forest clearing with wise animals teaching children - an owl, fox, and deer sharing their knowledge about nature',
    'story7' => 'A magical library where book characters come to life, jumping from pages to interact with young readers',
    'story8' => 'A music room with animated instruments - piano, drums, and violin playing together, creating beautiful harmony',
    'story9' => 'An art studio with living paints that mix and swirl, creating colorful pictures that tell stories',
    'story10' => 'A classroom where numbers dance and play, teaching math concepts in a fun and engaging way',
    'story11' => 'A magical classroom where letters dance and form words, making reading and writing exciting',
    'story12' => 'An art room where shapes transform - circles becoming wheels, squares becoming houses, triangles becoming mountains',
    'story13' => 'An art studio where colors come alive and mix - red and blue dancing to make purple, yellow and blue twirling to make green',
    'story14' => 'A classroom where animals teach children about nature - owl teaching about the night sky, fox showing plants, deer sharing forest secrets',
    'story15' => 'A music room where musical notes dance and create melodies, teaching children about music',
    'story16' => 'A writing room where words come alive and form stories, making writing magical and fun',
    'story17' => 'A math room where numbers play games and solve puzzles, making math exciting and engaging',
    'story18' => 'An art room where colors paint pictures and tell stories, showing the magic of art',
    'story19' => 'A nature room where animals share wisdom about the world, teaching children about the environment',
    'story20' => 'A music room where melodies create harmony, teaching children about the joy of music'
];

// Generate images for each story
foreach ($storyPrompts as $storyNumber => $prompt) {
    $filename = "images/{$storyNumber}.jpg";

    try {
        echo "Generating image for {$storyNumber}...\n";
        
        $response = $client->images()->create([
            'model' => 'dall-e-3',
            'prompt' => $prompt,
            'n' => 1,
            'size' => '1024x1024',
            'quality' => 'standard',
            'style' => 'vivid'
        ]);

        // Download and save the image
        $imageUrl = $response->data[0]->url;
        $imageData = file_get_contents($imageUrl);
        
        if ($imageData === false) {
            throw new Exception("Failed to download image from URL");
        }

        if (file_put_contents($filename, $imageData) === false) {
            throw new Exception("Failed to save image to file");
        }

        echo "Successfully generated and saved {$filename}\n";
        
        // Add a small delay to avoid rate limiting
        sleep(2);
        
    } catch (Exception $e) {
        echo "Error generating image for {$storyNumber}: " . $e->getMessage() . "\n";
        continue;
    }
}

echo "Image generation complete!\n"; 