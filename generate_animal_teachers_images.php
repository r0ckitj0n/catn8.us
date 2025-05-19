<?php
require 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$api_key = $_ENV['OPENAI_API_KEY'];
$client = OpenAI::client($api_key);

$images = [
    [
        'prompt' => "A heartwarming scene of a wise owl teaching a group of diverse children about the night sky in a forest clearing. The owl is perched on a tree branch, pointing to stars with its wing, while children sit in a circle below, looking up in wonder. The scene is magical and educational, with soft moonlight illuminating the scene.",
        'filename' => 'story14_middle.jpg'
    ],
    [
        'prompt' => "A playful scene of a friendly fox showing children how to identify different types of plants and flowers in a sunlit meadow. The fox is gently touching a flower with its paw while children gather around, taking notes and observing. The scene is bright, cheerful, and educational.",
        'filename' => 'story14_end.jpg'
    ],
    [
        'prompt' => "A joyful scene of children and various forest animals working together to plant trees and create a garden. Rabbits, squirrels, and birds are helping children dig holes and water plants, while a wise old turtle supervises. The scene shows teamwork and environmental stewardship.",
        'filename' => 'story14_beginning.jpg'
    ]
];

foreach ($images as $image) {
    try {
        $response = $client->images()->create([
            'model' => 'dall-e-3',
            'prompt' => $image['prompt'],
            'n' => 1,
            'size' => '1024x1024',
            'quality' => 'standard',
            'style' => 'vivid'
        ]);

        $image_url = $response->data[0]->url;
        $image_data = file_get_contents($image_url);
        
        if ($image_data === false) {
            throw new Exception("Failed to download image from URL");
        }

        $save_path = 'images/' . $image['filename'];
        if (file_put_contents($save_path, $image_data) === false) {
            throw new Exception("Failed to save image to {$save_path}");
        }

        echo "Successfully generated and saved {$image['filename']}\n";
        
        // Add a small delay between requests to avoid rate limiting
        sleep(2);
    } catch (Exception $e) {
        echo "Error generating {$image['filename']}: " . $e->getMessage() . "\n";
    }
} 