<?php
require 'vendor/autoload.php';

// Configuration
$api_key = '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';

// Initialize OpenAI client
$client = OpenAI::client($api_key);

try {
    // Make a simple API call to test the key
    $response = $client->models()->list();
    
    echo "API Key is valid! Successfully connected to OpenAI API.\n";
    echo "Available models:\n";
    foreach ($response->data as $model) {
        echo "- " . $model->id . "\n";
    }
} catch (Exception $e) {
    echo "Error testing API key:\n";
    echo "Message: " . $e->getMessage() . "\n";
    
    // Try to get more detailed error information
    if (method_exists($e, 'getError')) {
        $error = $e->getError();
        if ($error) {
            echo "OpenAI Error Details:\n";
            print_r($error);
        }
    }
    
    if (method_exists($e, 'getResponse')) {
        $response = $e->getResponse();
        if ($response) {
            echo "API Response:\n";
            echo $response->getBody() . "\n";
        }
    }
}
?> 