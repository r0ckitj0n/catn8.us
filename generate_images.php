<?php
// Create images directory if it doesn't exist
if (!file_exists('images')) {
    mkdir('images', 0755, true);
}

// Function to create a gradient image with playful elements
function createGradientImage($width, $height, $filename, $colors, $theme = '') {
    $image = imagecreatetruecolor($width, $height);
    
    // Create gradient
    for ($i = 0; $i < $height; $i++) {
        $ratio = $i / $height;
        $r = $colors[0][0] * (1 - $ratio) + $colors[1][0] * $ratio;
        $g = $colors[0][1] * (1 - $ratio) + $colors[1][1] * $ratio;
        $b = $colors[0][2] * (1 - $ratio) + $colors[1][2] * $ratio;
        
        $color = imagecolorallocate($image, $r, $g, $b);
        imageline($image, 0, $i, $width, $i, $color);
    }
    
    // Add playful elements based on theme
    switch($theme) {
        case 'coffee':
            // Draw coffee cup
            $cup = imagecolorallocate($image, 139, 69, 19);
            imagefilledellipse($image, $width/2, $height/2, 200, 150, $cup);
            $steam = imagecolorallocate($image, 255, 255, 255);
            for($i = 0; $i < 3; $i++) {
                imagearc($image, $width/2 + ($i-1)*30, $height/2 - 50, 20, 40, 0, 180, $steam);
            }
            break;
            
        case 'plants':
            // Draw plant
            $stem = imagecolorallocate($image, 34, 139, 34);
            imageline($image, $width/2, $height/2, $width/2, $height/2 - 100, $stem);
            $leaves = imagecolorallocate($image, 144, 238, 144);
            for($i = 0; $i < 5; $i++) {
                imagefilledellipse($image, $width/2 + cos($i*72)*50, $height/2 - 100 + sin($i*72)*50, 40, 20, $leaves);
            }
            break;
            
        case 'tech':
            // Draw computer
            $screen = imagecolorallocate($image, 70, 130, 180);
            imagefilledrectangle($image, $width/2 - 100, $height/2 - 75, $width/2 + 100, $height/2 + 75, $screen);
            $base = imagecolorallocate($image, 169, 169, 169);
            imagefilledrectangle($image, $width/2 - 50, $height/2 + 75, $width/2 + 50, $height/2 + 100, $base);
            break;
            
        case 'music':
            // Draw musical notes
            $notes = imagecolorallocate($image, 147, 112, 219);
            for($i = 0; $i < 3; $i++) {
                imagefilledellipse($image, $width/2 + $i*50, $height/2, 20, 20, $notes);
                imageline($image, $width/2 + $i*50 + 10, $height/2, $width/2 + $i*50 + 10, $height/2 - 50, $notes);
            }
            break;
            
        case 'books':
            // Draw books
            $book = imagecolorallocate($image, 165, 42, 42);
            for($i = 0; $i < 3; $i++) {
                imagefilledrectangle($image, $width/2 - 100 + $i*30, $height/2 - 50, $width/2 - 70 + $i*30, $height/2 + 50, $book);
            }
            break;
            
        case 'remote':
            // Draw remote
            $remote = imagecolorallocate($image, 47, 79, 79);
            imagefilledrectangle($image, $width/2 - 40, $height/2 - 100, $width/2 + 40, $height/2 + 100, $remote);
            $buttons = imagecolorallocate($image, 255, 255, 255);
            for($i = 0; $i < 4; $i++) {
                imagefilledellipse($image, $width/2, $height/2 - 50 + $i*30, 20, 20, $buttons);
            }
            break;
            
        case 'fitness':
            // Draw dumbbell
            $weight = imagecolorallocate($image, 220, 20, 60);
            imagefilledrectangle($image, $width/2 - 100, $height/2 - 20, $width/2 + 100, $height/2 + 20, $weight);
            imagefilledellipse($image, $width/2 - 100, $height/2, 40, 40, $weight);
            imagefilledellipse($image, $width/2 + 100, $height/2, 40, 40, $weight);
            break;
            
        case 'photos':
            // Draw photo frame
            $frame = imagecolorallocate($image, 255, 182, 193);
            imagefilledrectangle($image, $width/2 - 100, $height/2 - 75, $width/2 + 100, $height/2 + 75, $frame);
            $photo = imagecolorallocate($image, 255, 255, 255);
            imagefilledrectangle($image, $width/2 - 90, $height/2 - 65, $width/2 + 90, $height/2 + 65, $photo);
            break;
            
        case 'pets':
            // Draw paw print
            $paw = imagecolorallocate($image, 152, 251, 152);
            imagefilledellipse($image, $width/2, $height/2, 40, 40, $paw);
            for($i = 0; $i < 4; $i++) {
                imagefilledellipse($image, $width/2 + cos($i*90)*30, $height/2 + sin($i*90)*30, 20, 20, $paw);
            }
            break;
            
        case 'games':
            // Draw dice
            $dice = imagecolorallocate($image, 255, 218, 185);
            imagefilledrectangle($image, $width/2 - 50, $width/2 - 50, $width/2 + 50, $height/2 + 50, $dice);
            $dots = imagecolorallocate($image, 0, 0, 0);
            for($i = 0; $i < 6; $i++) {
                imagefilledellipse($image, $width/2 + cos($i*60)*30, $height/2 + sin($i*60)*30, 10, 10, $dots);
            }
            break;
    }
    
    // Add some decorative elements
    $accent = imagecolorallocate($image, 255, 230, 109); // Accent color
    for ($i = 0; $i < 5; $i++) {
        $x = rand(0, $width);
        $y = rand(0, $height);
        $size = rand(20, 50);
        imagefilledellipse($image, $x, $y, $size, $size, $accent);
    }
    
    // Save the image
    imagejpeg($image, $filename, 90);
    imagedestroy($image);
}

function createCartoonImage($width, $height, $filename, $theme) {
    $image = imagecreatetruecolor($width, $height);
    
    // Set background color based on theme
    switch($theme) {
        case 'family':
            $bg = imagecolorallocate($image, 255, 248, 220); // Warm beige
            break;
        case 'community':
            $bg = imagecolorallocate($image, 230, 255, 230); // Light green
            break;
        case 'random':
            $bg = imagecolorallocate($image, 255, 240, 245); // Light pink
            break;
        case 'growth':
            $bg = imagecolorallocate($image, 240, 248, 255); // Light blue
            break;
        case 'coffee':
            $bg = imagecolorallocate($image, 245, 245, 220); // Beige
            break;
        case 'plants':
            $bg = imagecolorallocate($image, 240, 255, 240); // Honeydew
            break;
        case 'tech':
            $bg = imagecolorallocate($image, 240, 248, 255); // Alice blue
            break;
        case 'music':
            $bg = imagecolorallocate($image, 255, 240, 245); // Lavender blush
            break;
        case 'books':
            $bg = imagecolorallocate($image, 255, 248, 220); // Cornsilk
            break;
        case 'remote':
            $bg = imagecolorallocate($image, 245, 245, 245); // White smoke
            break;
        case 'fitness':
            $bg = imagecolorallocate($image, 240, 255, 240); // Honeydew
            break;
        case 'photos':
            $bg = imagecolorallocate($image, 255, 250, 240); // Floral white
            break;
        case 'pets':
            $bg = imagecolorallocate($image, 255, 248, 220); // Cornsilk
            break;
        case 'games':
            $bg = imagecolorallocate($image, 240, 248, 255); // Alice blue
            break;
        case 'laundry':
            $bg = imagecolorallocate($image, 255, 255, 255); // White
            break;
        case 'garden_band':
            $bg = imagecolorallocate($image, 255, 255, 255); // White
            break;
        case 'cooking':
            $bg = imagecolorallocate($image, 255, 255, 255); // White
            break;
        default:
            $bg = imagecolorallocate($image, 255, 255, 255); // White
    }
    
    imagefill($image, 0, 0, $bg);
    
    // Draw theme-specific cartoon elements
    switch($theme) {
        case 'family':
            // Draw family members
            $skin = imagecolorallocate($image, 255, 218, 185); // Peach
            $hair = imagecolorallocate($image, 139, 69, 19); // Brown
            $clothes = imagecolorallocate($image, 70, 130, 180); // Blue
            
            // Draw parents
            imagefilledellipse($image, 300, 200, 100, 100, $skin); // Mom's face
            imagefilledellipse($image, 500, 200, 100, 100, $skin); // Dad's face
            
            // Draw children
            imagefilledellipse($image, 350, 350, 80, 80, $skin); // Child 1
            imagefilledellipse($image, 450, 350, 80, 80, $skin); // Child 2
            
            // Draw hair
            imagefilledarc($image, 300, 150, 120, 80, 0, 180, $hair, IMG_ARC_PIE); // Mom's hair
            imagefilledarc($image, 500, 150, 120, 80, 0, 180, $hair, IMG_ARC_PIE); // Dad's hair
            
            // Draw clothes
            imagefilledrectangle($image, 250, 250, 350, 400, $clothes); // Mom's dress
            imagefilledrectangle($image, 450, 250, 550, 400, $clothes); // Dad's shirt
            break;
            
        case 'community':
            // Draw community garden
            $green = imagecolorallocate($image, 34, 139, 34); // Forest green
            $brown = imagecolorallocate($image, 139, 69, 19); // Brown
            $yellow = imagecolorallocate($image, 255, 255, 0); // Yellow
            
            // Draw plants
            for($i = 0; $i < 5; $i++) {
                // Draw stems
                imageline($image, 150 + $i*150, 400, 150 + $i*150, 300, $brown);
                // Draw leaves
                imagefilledellipse($image, 150 + $i*150, 300, 60, 40, $green);
                // Draw flowers
                imagefilledellipse($image, 150 + $i*150, 250, 30, 30, $yellow);
            }
            break;
            
        case 'coffee':
            // Draw coffee shop scene
            $brown = imagecolorallocate($image, 139, 69, 19); // Brown
            $white = imagecolorallocate($image, 255, 255, 255); // White
            $black = imagecolorallocate($image, 0, 0, 0); // Black
            
            // Draw coffee cup
            imagefilledellipse($image, 400, 300, 200, 150, $white);
            imagefilledellipse($image, 400, 300, 180, 130, $brown);
            // Draw steam
            for($i = 0; $i < 3; $i++) {
                imagearc($image, 400 + ($i-1)*30, 200, 20, 40, 0, 180, $black);
            }
            break;
            
        case 'plants':
            // Draw plant scene
            $green = imagecolorallocate($image, 34, 139, 34); // Forest green
            $brown = imagecolorallocate($image, 139, 69, 19); // Brown
            $pink = imagecolorallocate($image, 255, 192, 203); // Pink
            
            // Draw pot
            imagefilledrectangle($image, 300, 400, 500, 500, $brown);
            // Draw plant
            imagefilledellipse($image, 400, 300, 200, 200, $green);
            // Draw flowers
            for($i = 0; $i < 5; $i++) {
                imagefilledellipse($image, 400 + cos($i*72)*100, 300 + sin($i*72)*100, 40, 40, $pink);
            }
            break;
            
        case 'tech':
            // Draw tech scene
            $gray = imagecolorallocate($image, 128, 128, 128); // Gray
            $blue = imagecolorallocate($image, 0, 0, 255); // Blue
            $black = imagecolorallocate($image, 0, 0, 0); // Black
            
            // Draw computer
            imagefilledrectangle($image, 300, 200, 500, 400, $gray);
            imagefilledrectangle($image, 350, 250, 450, 350, $blue);
            // Draw keyboard
            imagefilledrectangle($image, 250, 450, 550, 500, $black);
            break;
            
        case 'music':
            // Draw music scene
            $brown = imagecolorallocate($image, 139, 69, 19); // Brown
            $black = imagecolorallocate($image, 0, 0, 0); // Black
            $gold = imagecolorallocate($image, 255, 215, 0); // Gold
            
            // Draw guitar
            imagefilledellipse($image, 400, 300, 200, 100, $brown);
            // Draw strings
            for($i = 0; $i < 6; $i++) {
                imageline($image, 300, 250 + $i*10, 500, 250 + $i*10, $black);
            }
            // Draw notes
            for($i = 0; $i < 3; $i++) {
                imagefilledellipse($image, 200 + $i*100, 200, 20, 20, $black);
                imageline($image, 200 + $i*100 + 10, 200, 200 + $i*100 + 10, 150, $black);
            }
            break;
            
        case 'books':
            // Draw library scene
            $brown = imagecolorallocate($image, 139, 69, 19); // Brown
            $red = imagecolorallocate($image, 255, 0, 0); // Red
            $blue = imagecolorallocate($image, 0, 0, 255); // Blue
            $green = imagecolorallocate($image, 0, 255, 0); // Green
            
            // Draw bookshelf
            imagefilledrectangle($image, 200, 100, 600, 500, $brown);
            // Draw books
            $colors = [$red, $blue, $green, $brown];
            for($i = 0; $i < 4; $i++) {
                for($j = 0; $j < 5; $j++) {
                    imagefilledrectangle($image, 250 + $i*80, 150 + $j*60, 300 + $i*80, 200 + $j*60, $colors[$i]);
                }
            }
            break;
            
        case 'remote':
            // Draw remote control
            $black = imagecolorallocate($image, 0, 0, 0); // Black
            $red = imagecolorallocate($image, 255, 0, 0); // Red
            $gray = imagecolorallocate($image, 128, 128, 128); // Gray
            
            // Draw remote body
            imagefilledrectangle($image, 350, 200, 450, 400, $black);
            // Draw buttons
            for($i = 0; $i < 4; $i++) {
                imagefilledellipse($image, 400, 250 + $i*30, 30, 30, $red);
            }
            break;
            
        case 'fitness':
            // Draw fitness scene
            $gray = imagecolorallocate($image, 128, 128, 128); // Gray
            $red = imagecolorallocate($image, 255, 0, 0); // Red
            $black = imagecolorallocate($image, 0, 0, 0); // Black
            
            // Draw dumbbell
            imagefilledrectangle($image, 300, 250, 500, 350, $gray);
            imagefilledellipse($image, 300, 300, 50, 50, $black);
            imagefilledellipse($image, 500, 300, 50, 50, $black);
            break;
            
        case 'photos':
            // Draw photo frames
            $gold = imagecolorallocate($image, 255, 215, 0); // Gold
            $white = imagecolorallocate($image, 255, 255, 255); // White
            
            // Draw frames
            for($i = 0; $i < 3; $i++) {
                imagefilledrectangle($image, 200 + $i*200, 200, 300 + $i*200, 300, $gold);
                imagefilledrectangle($image, 210 + $i*200, 210, 290 + $i*200, 290, $white);
            }
            break;
            
        case 'pets':
            // Draw pet scene
            $orange = imagecolorallocate($image, 255, 165, 0); // Orange
            $black = imagecolorallocate($image, 0, 0, 0); // Black
            $white = imagecolorallocate($image, 255, 255, 255); // White
            
            // Draw cat
            imagefilledellipse($image, 400, 300, 100, 100, $orange);
            // Draw ears
            imagefilledpolygon($image, [350, 250, 370, 200, 390, 250], 3, $orange);
            imagefilledpolygon($image, [410, 250, 430, 200, 450, 250], 3, $orange);
            // Draw eyes
            imagefilledellipse($image, 380, 290, 10, 10, $black);
            imagefilledellipse($image, 420, 290, 10, 10, $black);
            // Draw nose
            imagefilledellipse($image, 400, 300, 5, 5, $black);
            break;
            
        case 'games':
            // Draw game night scene
            $red = imagecolorallocate($image, 255, 0, 0); // Red
            $blue = imagecolorallocate($image, 0, 0, 255); // Blue
            $green = imagecolorallocate($image, 0, 255, 0); // Green
            $yellow = imagecolorallocate($image, 255, 255, 0); // Yellow
            
            // Draw game board
            imagefilledrectangle($image, 300, 200, 500, 400, $red);
            // Draw game pieces
            imagefilledellipse($image, 350, 250, 30, 30, $blue);
            imagefilledellipse($image, 450, 250, 30, 30, $green);
            imagefilledellipse($image, 350, 350, 30, 30, $yellow);
            imagefilledellipse($image, 450, 350, 30, 30, $blue);
            break;
            
        case 'laundry':
            // Draw washing machine scene
            $gray = imagecolorallocate($image, 128, 128, 128); // Gray
            $blue = imagecolorallocate($image, 0, 0, 255); // Blue
            $red = imagecolorallocate($image, 255, 0, 0); // Red
            $yellow = imagecolorallocate($image, 255, 255, 0); // Yellow
            
            // Draw washing machine
            imagefilledrectangle($image, 300, 200, 500, 400, $gray);
            // Draw door
            imagefilledellipse($image, 400, 300, 150, 150, $blue);
            // Draw clothes inside
            imagefilledellipse($image, 380, 280, 30, 30, $red);
            imagefilledellipse($image, 420, 320, 30, 30, $yellow);
            break;
            
        case 'garden_band':
            // Draw garden band scene
            $green = imagecolorallocate($image, 34, 139, 34); // Forest green
            $yellow = imagecolorallocate($image, 255, 255, 0); // Yellow
            $pink = imagecolorallocate($image, 255, 192, 203); // Pink
            $brown = imagecolorallocate($image, 139, 69, 19); // Brown
            
            // Draw plants
            for($i = 0; $i < 3; $i++) {
                // Draw stems
                imageline($image, 200 + $i*200, 400, 200 + $i*200, 300, $brown);
                // Draw leaves
                imagefilledellipse($image, 200 + $i*200, 300, 60, 40, $green);
                // Draw flowers
                imagefilledellipse($image, 200 + $i*200, 250, 40, 40, $pink);
            }
            // Draw musical notes
            for($i = 0; $i < 3; $i++) {
                imagefilledellipse($image, 150 + $i*100, 200, 20, 20, $yellow);
                imageline($image, 150 + $i*100 + 10, 200, 150 + $i*100 + 10, 150, $yellow);
            }
            break;
            
        case 'cooking':
            // Draw cooking scene
            $brown = imagecolorallocate($image, 139, 69, 19); // Brown
            $red = imagecolorallocate($image, 255, 0, 0); // Red
            $green = imagecolorallocate($image, 0, 255, 0); // Green
            $yellow = imagecolorallocate($image, 255, 255, 0); // Yellow
            
            // Draw cookbook
            imagefilledrectangle($image, 300, 200, 500, 400, $brown);
            // Draw ingredients
            imagefilledellipse($image, 350, 250, 30, 30, $red);
            imagefilledellipse($image, 450, 250, 30, 30, $green);
            imagefilledellipse($image, 400, 300, 30, 30, $yellow);
            break;
    }
    
    // Save the image
    imagejpeg($image, $filename, 90);
    imagedestroy($image);
}

// Create story images with themes
$images = [
    'story1.jpg' => 'family',
    'story2.jpg' => 'community',
    'story3.jpg' => 'random',
    'story4.jpg' => 'growth',
    'story5.jpg' => 'community',
    'story6.jpg' => 'family',
    'story7.jpg' => 'coffee',
    'story8.jpg' => 'plants',
    'story9.jpg' => 'tech',
    'story10.jpg' => 'coffee',
    'story11.jpg' => 'music',
    'story12.jpg' => 'books',
    'story13.jpg' => 'remote',
    'story14.jpg' => 'fitness',
    'story15.jpg' => 'photos',
    'story16.jpg' => 'pets',
    'story17.jpg' => 'games',
    'story18.jpg' => 'laundry',
    'story19.jpg' => 'garden_band',
    'story20.jpg' => 'cooking'
];

foreach ($images as $filename => $theme) {
    createCartoonImage(800, 600, "images/$filename", $theme);
}

echo "Cartoon images generated successfully!\n";
?> 