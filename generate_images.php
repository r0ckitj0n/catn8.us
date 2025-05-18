<?php
require 'vendor/autoload.php';

// Configuration
$api_key = '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';
$image_size = '1024x1024';
$output_dir = 'images/';
$max_retries = 3;
$retry_delay = 5; // seconds

// Create output directory if it doesn't exist
if (!file_exists($output_dir)) {
    mkdir($output_dir, 0777, true);
}

// Only include the single image we want to generate
$images = [
    'story10_middle.jpg' => [
        'prompt' => 'Jumping Jack Jill, Push-up Pete, and Running Rita making exercise fun',
        'style' => 'vivid'
    ]
];

// Initialize OpenAI client
$client = OpenAI::client($api_key);

// Function to generate a single image with retries
function generateImage($client, $filename, $config, $output_dir, $max_retries, $retry_delay) {
    $attempt = 1;
    
    while ($attempt <= $max_retries) {
        echo "\nAttempt $attempt of $max_retries for $filename...\n";
        echo "Prompt: " . $config['prompt'] . "\n";
        
        try {
            echo "Making API request...\n";
            $response = $client->images()->create([
                'model' => 'dall-e-3',
                'prompt' => $config['prompt'],
                'size' => '1024x1024',
                'quality' => 'standard',
                'style' => $config['style'],
                'response_format' => 'url'
            ]);

            echo "API request successful!\n";
            echo "Downloading image...\n";
            
            // Download and save the image
            $image_url = $response->data[0]->url;
            $image_data = file_get_contents($image_url);
            
            if ($image_data === false) {
                throw new Exception("Failed to download image from URL");
            }
            
            $save_result = file_put_contents($output_dir . $filename, $image_data);
            
            if ($save_result === false) {
                throw new Exception("Failed to save image to file");
            }
            
            echo "Successfully generated and saved $filename\n";
            return true;
            
        } catch (Exception $e) {
            echo "Error on attempt $attempt:\n";
            echo "Message: " . $e->getMessage() . "\n";
            
            if ($attempt < $max_retries) {
                echo "Waiting $retry_delay seconds before retrying...\n";
                sleep($retry_delay);
            }
            
            $attempt++;
        }
    }
    
    echo "Failed to generate $filename after $max_retries attempts\n";
    return false;
}

// Generate the single image
$successful = 0;
$failed = 0;

foreach ($images as $filename => $config) {
    if (generateImage($client, $filename, $config, $output_dir, $max_retries, $retry_delay)) {
        $successful++;
    } else {
        $failed++;
    }
}

echo "\nImage generation process complete!\n";
echo "Successfully generated: $successful images\n";
echo "Failed to generate: $failed images\n";
?> 