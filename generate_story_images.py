import openai
import os
import time
import requests
from pathlib import Path

# Initialize OpenAI client
client = openai.OpenAI()

def generate_image(prompt, output_path):
    """Generate an image using DALL-E 3"""
    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        
        # Download the image
        image_url = response.data[0].url
        image_response = requests.get(image_url)
        
        # Save the image
        with open(output_path, 'wb') as f:
            f.write(image_response.content)
            
        print(f"Generated image: {output_path}")
        return True
    except Exception as e:
        print(f"Error generating image: {e}")
        return False

def create_story_prompts():
    """Create prompts for all story images with descriptive filenames"""
    prompts = {
        # Story 14: The Sparkle House Family
        "sparkle_house_family_middle": "A warm, inviting living room scene with a modern illustration style. A Caucasian family (parents and children of various ages) sits together in a house that sparkles with rainbow colors. The walls glow with magical light and the windows twinkle like stars. The illustration has clean lines, vibrant colors, and a contemporary feel.",
        "sparkle_house_family_end": "A magical nighttime scene of a house with a modern illustration style. The house sparkles with rainbow lights, and a Caucasian family (parents and children) stands outside looking up in wonder. The house glows with love and magic. The illustration features clean lines, vibrant colors, and a contemporary feel.",
        
        # Story 15: The Art Adventure Squad
        "art_adventure_squad_middle": "A vibrant art room with a modern illustration style. Caucasian children and adults create art together in a bright, colorful space. Paintbrushes and crayons dance in the air, creating magical patterns and colors. The illustration has clean lines, vibrant colors, and a contemporary feel.",
        "art_adventure_squad_end": "A family art gallery with a modern illustration style. A Caucasian family (parents and children) admires their magical artwork. The art pieces come to life with dancing colors and shapes. The illustration features clean lines, vibrant colors, and a contemporary feel.",
        
        # Story 16: The Bedtime Book Buddies
        "bedtime_book_buddies_middle": "A cozy bedroom with a modern illustration style. A Caucasian child in pajamas is surrounded by magical books that float and glow. The books have friendly faces and are telling stories. The illustration has clean lines, vibrant colors, and a contemporary feel.",
        "bedtime_book_buddies_end": "A peaceful bedroom scene with a modern illustration style. A Caucasian child sleeps peacefully while magical story characters dance in the air above the bed. The illustration features clean lines, vibrant colors, and a contemporary feel.",
        
        # Story 17: The Pet Tech Team
        "pet_tech_team_middle": "A living room with a modern illustration style. Caucasian children and adults work with their pets (cat, turtle, and puppy) using technology. The pets are helping with computers and tablets. The illustration has clean lines, vibrant colors, and a contemporary feel.",
        "pet_tech_team_end": "A family room with a modern illustration style. A happy Caucasian family (parents and children) works with their tech-savvy pets. The pets are using technology to help the family learn and play together. The illustration features clean lines, vibrant colors, and a contemporary feel.",
        
        # Story 18: The Laundry Day Llamas
        "laundry_day_llamas_middle": "A laundry room with a modern illustration style. Friendly llamas fold clothes into origami shapes while Caucasian children and adults watch in amazement. The illustration has clean lines, vibrant colors, and a contemporary feel.",
        "laundry_day_llamas_end": "A fashion show with a modern illustration style. Llamas present origami clothes to a delighted Caucasian family (parents and children). The clothes sparkle with magical colors. The illustration features clean lines, vibrant colors, and a contemporary feel.",
        
        # Story 19: The Garden Growth Gang
        "garden_growth_gang_middle": "A magical garden with a modern illustration style. Talking plants and trees surround Caucasian children and adults working together. The plants dance and glow with magical colors. The illustration has clean lines, vibrant colors, and a contemporary feel.",
        "garden_growth_gang_end": "A beautiful garden with a modern illustration style. A Caucasian family (parents and children) is surrounded by magical plants that have grown into a colorful paradise. The plants sparkle with joy. The illustration features clean lines, vibrant colors, and a contemporary feel.",
        
        # Story 20: The Family Fun Factory
        "family_fun_factory_middle": "A magical house with a modern illustration style. Rooms transform into different adventures as Caucasian children and adults explore with wonder. The illustration has clean lines, vibrant colors, and a contemporary feel.",
        "family_fun_factory_end": "A happy family scene with a modern illustration style. A Caucasian family (parents and children) enjoys their magical home. The house sparkles with love and joy. The illustration features clean lines, vibrant colors, and a contemporary feel."
    }
    return prompts

def main():
    # Create images directory if it doesn't exist
    Path("images").mkdir(exist_ok=True)
    
    # Get prompts for all images
    prompts = create_story_prompts()
    
    # Generate each image
    for image_name, prompt in prompts.items():
        output_path = f"images/{image_name}.jpg"
        if not os.path.exists(output_path):
            success = generate_image(prompt, output_path)
            if success:
                time.sleep(1)  # Rate limiting
            else:
                print(f"Failed to generate {image_name}")
        else:
            print(f"Image already exists: {output_path}")

if __name__ == "__main__":
    main() 