<?php
require 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$api_key = $_ENV['OPENAI_API_KEY'];
$client = OpenAI::client($api_key);

// Stories that need preview images
$stories_needing_preview = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14];

// Generate preview images for stories that need them
foreach ($stories_needing_preview as $story_num) {
    $preview_filename = sprintf('images/story%d.jpg', $story_num);
    
    // Skip if preview image already exists
    if (file_exists($preview_filename)) {
        echo "Preview image already exists for story $story_num\n";
        continue;
    }

    try {
        // Generate a preview image that represents the story
        $response = $client->images()->create([
            'model' => 'dall-e-3',
            'prompt' => "A warm, inviting scene that represents a children's story about family, learning, and growth. The image should be suitable for a story preview card, showing a diverse group of children and adults in a positive, engaging moment.",
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

        if (file_put_contents($preview_filename, $image_data) === false) {
            throw new Exception("Failed to save image to {$preview_filename}");
        }

        echo "Successfully generated preview image for story $story_num\n";
        
        // Add a small delay between requests to avoid rate limiting
        sleep(2);
    } catch (Exception $e) {
        echo "Error generating preview image for story $story_num: " . $e->getMessage() . "\n";
    }
}

// Convert PNG files to JPG and rename them
$png_files = [
    'story13.png' => 'story13.jpg',
    'story15.png' => 'story15.jpg',
    'story16.png' => 'story16.jpg',
    'story17.png' => 'story17.jpg',
    'story18.png' => 'story18.jpg',
    'story19.png' => 'story19.jpg',
    'story20.png' => 'story20.jpg'
];

foreach ($png_files as $png_file => $jpg_file) {
    $png_path = 'images/' . $png_file;
    $jpg_path = 'images/' . $jpg_file;
    
    if (file_exists($png_path)) {
        // Convert PNG to JPG
        $image = imagecreatefrompng($png_path);
        if ($image !== false) {
            // Create a white background
            $bg = imagecreatetruecolor(imagesx($image), imagesy($image));
            $white = imagecolorallocate($bg, 255, 255, 255);
            imagefill($bg, 0, 0, $white);
            
            // Copy the PNG onto the white background
            imagecopy($bg, $image, 0, 0, 0, 0, imagesx($image), imagesy($image));
            
            // Save as JPG
            imagejpeg($bg, $jpg_path, 90);
            
            // Clean up
            imagedestroy($image);
            imagedestroy($bg);
            
            // Remove the original PNG file
            unlink($png_path);
            
            echo "Converted $png_file to $jpg_file\n";
        }
    }
} 