<?php
require 'vendor/autoload.php';
require 'config.php';

use OpenAI\Client;

$client = OpenAI::client($_ENV['OPENAI_API_KEY']);

$storyPrompts = [
    'story11' => [
        'beginning' => "A magical art studio where paintbrushes and colors come alive, creating a vibrant and creative atmosphere, with children watching in amazement as colors dance and mix in the air.",
        'middle' => "Children and animated paintbrushes working together to create a masterpiece, with colors swirling and mixing in magical patterns, showing the joy of artistic collaboration.",
        'end' => "A beautiful gallery filled with children's artwork created with the help of magical paintbrushes, showing the power of creativity and imagination."
    ],
    'story15' => [
        'beginning' => "A magical music room where musical notes float in the air, each with its own personality and color, creating a symphony of visual and musical elements.",
        'middle' => "Children dancing and playing with animated musical notes, creating beautiful melodies as the notes bounce and twirl around them in a joyful musical celebration.",
        'end' => "A grand musical performance where children and musical notes work together to create a beautiful harmony, filling the room with magical music and joy."
    ],
    'story16' => [
        'beginning' => "A magical writing room where words float in the air, each glowing with its own color and personality, creating a literary wonderland of animated text.",
        'middle' => "Children working with animated words to create stories, as the words dance and arrange themselves into beautiful sentences and paragraphs.",
        'end' => "A library filled with magical books created by the children and their word friends, showing the power of storytelling and imagination."
    ],
    'story17' => [
        'beginning' => "A magical math room where numbers float in the air, each with its own personality and color, creating a mathematical wonderland of animated digits.",
        'middle' => "Children solving puzzles with animated numbers, as the numbers dance and arrange themselves into equations and patterns.",
        'end' => "A celebration of mathematical discovery, where children and their number friends have solved a grand puzzle, showing the joy of learning and problem-solving."
    ],
    'story20' => [
        'beginning' => "A magical music room where melodies float in the air as visible waves of color and light, creating a symphony of visual and musical elements.",
        'middle' => "Children creating music with animated melodies, as the musical waves dance and combine to create beautiful harmonies.",
        'end' => "A grand musical performance where children and their melody friends create a beautiful symphony, filling the room with magical music and joy."
    ]
];

foreach ($storyPrompts as $storyId => $prompts) {
    foreach ($prompts as $position => $prompt) {
        $filename = "images/{$storyId}_{$position}.jpg";
        
        try {
            $response = $client->images()->create([
                'model' => 'dall-e-3',
                'prompt' => $prompt,
                'n' => 1,
                'size' => '1024x1024',
                'quality' => 'standard',
                'style' => 'vivid'
            ]);

            $imageUrl = $response->data[0]->url;
            $imageData = file_get_contents($imageUrl);
            
            if ($imageData === false) {
                throw new Exception("Failed to download image from URL");
            }
            
            if (file_put_contents($filename, $imageData) === false) {
                throw new Exception("Failed to save image to file");
            }
            
            echo "Generated and saved {$filename}\n";
            
            // Add a small delay to avoid rate limiting
            sleep(1);
            
        } catch (Exception $e) {
            echo "Error generating {$filename}: " . $e->getMessage() . "\n";
        }
    }
}

echo "Image generation complete.\n"; 