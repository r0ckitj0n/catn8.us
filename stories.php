<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stories - catn8.us</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.css">
    <style>
        :root {
            --primary-color: #FF6B6B;
            --secondary-color: #4ECDC4;
            --accent-color: #FFE66D;
            --dark-color: #2C3E50;
            --light-color: #F7F9FC;
        }

        body {
            font-family: 'Comic Sans MS', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: var(--dark-color);
            background-color: var(--light-color);
            background-image: url('images/pattern.svg');
            background-size: 200px;
            background-repeat: repeat;
        }

        .navbar {
            background: rgba(255, 255, 255, 0.95);
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .navbar-brand img {
            height: 40px;
        }

        .navbar-dark .navbar-nav .nav-link {
            color: var(--dark-color) !important;
            font-weight: 700;
            font-size: 20px;
            padding: 0.5rem 1rem;
            transition: color 0.3s ease;
        }

        .navbar-dark .navbar-nav .nav-link:hover {
            color: var(--primary-color) !important;
        }

        .navbar-dark .navbar-nav .nav-link.active {
            color: var(--primary-color) !important;
            font-weight: 600;
        }

        .navbar-toggler {
            border-color: var(--dark-color);
        }

        .navbar-toggler-icon {
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba(44, 62, 80, 1)' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
        }

        .hero {
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            color: white;
            padding: 4rem 0;
            position: relative;
            overflow: hidden;
            margin-bottom: 2rem;
        }

        .hero h1 {
            font-size: 3.5rem;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
            color: #5DBCB3 !important;
            margin-bottom: 1rem;
        }

        .hero p {
            font-size: 1.5rem;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
            margin-bottom: 0;
        }

        .stories-section {
            padding: 5rem 0;
            background: var(--light-color);
        }

        .story-card {
            background: white;
            border-radius: 20px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: all 0.5s ease;
            cursor: pointer;
            border: 3px solid transparent;
            position: relative;
            overflow: hidden;
            height: 429px;  /* Increased from 390px by 10% */
            display: flex;
            flex-direction: column;
        }

        .story-content {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .story-image {
            width: 100%;
            height: 214px;  /* Increased from 195px by 10% */
            object-fit: cover;
            border-radius: 15px;
            margin-bottom: 1rem;
            border: 3px solid var(--accent-color);
        }

        .story-card h3 {
            font-size: 1.2rem;
            margin-bottom: 0.5rem;
            color: #5DBCB3;
            font-weight: bold;
        }

        .story-card p {
            font-size: 0.9rem;
            color: var(--dark-color);
            margin-bottom: 0.5rem;
            flex-grow: 1;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }

        .story-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 0.5rem;
        }

        .story-tag {
            background: var(--accent-color);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 15px;
            font-size: 0.8rem;
        }

        .story-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            border-color: var(--accent-color);
        }

        .story-image.error {
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.2rem;
            text-align: center;
            padding: 1rem;
        }

        .story-modal .modal-content {
            border-radius: 20px;
            border: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }

        .story-modal .modal-header {
            border-bottom: none;
            padding: 2rem 2rem 1rem;
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            color: white;
            border-radius: 20px 20px 0 0;
        }

        .story-modal .modal-body {
            padding: 2rem;
            font-size: 1.2rem;
        }

        .story-modal .modal-image {
            width: 100%;
            max-height: 400px;
            object-fit: cover;
            border-radius: 15px;
            margin-bottom: 1.5rem;
            border: 3px solid var(--accent-color);
        }

        .story-modal .modal-image.error {
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.5rem;
            text-align: center;
            padding: 2rem;
        }

        .story-navigation {
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 1000;
            background: white;
            padding: 20px;
            border-radius: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            border: 3px solid var(--accent-color);
        }

        .story-navigation .nav-item {
            margin: 15px 0;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1.2rem;
            padding: 10px;
            border-radius: 15px;
            text-align: center;
        }

        .story-navigation .nav-item:hover {
            background: var(--accent-color);
            transform: scale(1.1);
        }

        .story-navigation .nav-item.active {
            background: var(--primary-color);
            color: white;
            transform: scale(1.1);
        }

        .story-pagination {
            display: none;
        }

        @keyframes float {
            0% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0); }
        }

        .floating {
            animation: float 3s ease-in-out infinite;
        }

        /* Add new animation styles */
        .story-card {
            transition: all 0.5s ease;
        }

        .story-card.fade-out {
            opacity: 0;
            transform: translateY(20px);
        }

        .story-card.fade-in {
            opacity: 1;
            transform: translateY(0);
        }

        .page-transition {
            position: relative;
            min-height: 600px; /* Adjust based on your content */
        }

        .page-transition .row {
            position: absolute;
            width: 100%;
            transition: all 0.5s ease;
        }

        .page-transition .row.slide-out {
            opacity: 0;
            transform: translateX(-50px);
        }

        .page-transition .row.slide-in {
            opacity: 1;
            transform: translateX(0);
        }

        .story-box {
            background: white;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
            height: 300px;
            display: flex;
            flex-direction: column;
        }

        .story-box img {
            width: 100%;
            height: 150px;
            object-fit: cover;
            border-radius: 10px;
            margin-bottom: 15px;
        }

        .story-box h3 {
            font-size: 1.2rem;
            margin-bottom: 10px;
            color: var(--primary-color);
        }

        .story-box p {
            font-size: 0.9rem;
            color: var(--dark-color);
            margin-bottom: 0;
            flex-grow: 1;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
        }

        .story-box:hover {
            transform: translateY(-5px);
        }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark fixed-top">
        <div class="container">
            <a class="navbar-brand" href="/">
                <img src="images/catn8_logo.jpeg" alt="catn8.us Logo" height="40">
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="/">Home</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="about.php">About</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link active" href="stories.php">Stories</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="games.php">Games</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/#guiding-lights">Our Lights</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/#invitation">Our Circle</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="hero">
        <div class="container">
            <div class="row justify-content-center">
                <div class="col-md-8 text-center" data-aos="fade-up">
                    <h1>Stories of Kindness</h1>
                    <p class="lead">Every act of kindness, no matter how small, creates ripples of love that touch countless lives. Here, we share stories that inspire, heal, and connect us all.</p>
                </div>
            </div>
        </div>
    </section>

    <div class="story-navigation">
        <div class="nav-item active" data-category="all">All Stories</div>
        <div class="nav-item" data-category="family">Family Moments</div>
        <div class="nav-item" data-category="community">Community</div>
        <div class="nav-item" data-category="random">Random Acts</div>
        <div class="nav-item" data-category="growth">Personal Growth</div>
        <div class="nav-item" data-category="daily">Daily Kindness</div>
    </div>

    <section class="stories-section">
        <div class="container">
            <div class="row">
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal1">
                        <div class="story-content">
                            <img src="images/story1.png" alt="The Super Sparkle Family" class="story-image">
                            <h3>The Super Sparkle Family!</h3>
                            <p>When Papa and Nana's magical sparkle powers bring their family together, they create a world of wonder and joy that spreads love and kindness to everyone around them.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Family</span>
                            <span class="story-tag">Kindness</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal2">
                        <div class="story-content">
                            <img src="images/story2.png" alt="Elijah's Kitchen of Culinary Craziness" class="story-image">
                            <h3>Elijah's Kitchen of Culinary Craziness</h3>
                            <p>When Elijah's kitchen appliances come to life with their own personalities, they turn cooking into a wild adventure, teaching him that making food can be as fun as eating it.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Daily Kindness</span>
                            <span class="story-tag">Creativity</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal3">
                        <div class="story-content">
                            <img src="images/story3.png" alt="Trinity's Teeny-Tiny Treat Fairies" class="story-image">
                            <h3>Trinity's Teeny-Tiny Treat Fairies!</h3>
                            <p>When Trinity's kitchen becomes home to magical fairies, they help her create special treats that bring joy to her daughters Violet and Ella, and everyone in the family.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Family</span>
                            <span class="story-tag">Magic</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal4" data-category="growth">
                        <div class="story-content">
                            <img src="images/story4.png" alt="Reuel's Wacky Puzzle Family" class="story-image">
                            <h3>Reuel's Wacky Puzzle Family!</h3>
                            <p>Reuel loved puzzles, but he never expected his puzzle pieces to come to life! Each piece represented a member of his family, and they all had their own personalities.</p>
                            <p>There was Papa and Nana's piece, strong and wise. Trinity's piece was creative and kind, while Mariah's piece was full of energy. Veronica's piece brought laughter, and Elijah's piece was always cooking up new ideas.</p>
                            <p>Ezra's piece was thoughtful and quiet, while Ian's piece was full of adventure. Marisa's piece brought beauty to everything, and little Lyra's piece was the sparkle that made everything complete.</p>
                            <p>As Reuel put the puzzle together, he discovered that each piece was unique and important. Just like in his real family, every piece fit together perfectly to create a beautiful picture of love and support!</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Family</span>
                            <span class="story-tag">Magic</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal5" data-category="community">
                        <div class="story-content">
                            <img src="images/story5.png" alt="The Super-Sticky Hug Team" class="story-image">
                            <h3>The Super-Sticky Hug Team!</h3>
                            <p>Papa and Nana had a special power - their hugs were so full of love that they stuck with you forever! When they hugged someone, a little bit of their love magic would stay with them, helping them through any challenge.</p>
                            <p>Their hugs helped Trinity find strength when she needed it most, gave Elijah confidence in the kitchen, and helped Reuel solve his trickiest puzzles. The magic spread to Mariah, Veronica, Ezra, Ian, Marisa, and little Lyra too!</p>
                            <p>Soon, everyone in the family learned to share their own super-sticky hugs. When someone was sad, a hug would make them feel better. When someone was scared, a hug would make them brave. And when someone was happy, a hug would make that joy last even longer!</p>
                            <p>The Super-Sticky Hug Team showed everyone that love is the strongest magic of all, and that family support can help you overcome anything!</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Family</span>
                            <span class="story-tag">Magic</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal6" data-category="daily">
                        <div class="story-content">
                            <img src="images/story6.png" alt="Daily Kindness" class="story-image">
                            <h3>Finding Strength in Family</h3>
                            <p>When little Mia discovers her stuffed animals can share their special powers, she learns that true strength comes from family bonds and believing in yourself.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Daily Kindness</span>
                            <span class="story-tag">Family</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal7" data-category="random">
                        <div class="story-content">
                            <img src="images/story7.png" alt="Family Innovation" class="story-image">
                            <h3>Trinity's Totally Bonkers Tablet of Kindness</h3>
                            <p>When Trinity's tablet comes to life with a personality of its own, it helps her family spread joy and laughter through silly antics and unexpected kindness.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Random Acts</span>
                            <span class="story-tag">Family</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal8" data-category="growth">
                        <div class="story-content">
                            <img src="images/story8.png" alt="Family Growth" class="story-image">
                            <h3>Mariah's Ridiculously Rhythmic Dancing Garden</h3>
                            <p>When Mariah's garden comes alive with dancing plants, it teaches her family about the joy of movement and the magic of nature. A whimsical tale about finding rhythm in unexpected places.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Growth</span>
                            <span class="story-tag">Family</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal9" data-category="family">
                        <div class="story-content">
                            <img src="images/story9.png" alt="Family Harmony" class="story-image">
                            <h3>Trinity's Hilariously Helpful Smart Home Gadgets</h3>
                            <p>When Trinity's smart home devices develop quirky personalities, they turn everyday tasks into fun adventures and help her family create a more joyful home environment.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Family Moments</span>
                            <span class="story-tag">Innovation</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal2" data-category="daily">
                        <div class="story-content">
                            <img src="images/story2.png" alt="Elijah's Kitchen of Culinary Craziness" class="story-image">
                            <h3>Elijah's Kitchen of Culinary Craziness</h3>
                            <p>When Elijah's kitchen appliances come to life with their own personalities, they turn cooking into a wild adventure, teaching him that making food can be as fun as eating it.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Daily Kindness</span>
                            <span class="story-tag">Creativity</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal11" data-category="growth">
                        <div class="story-content">
                            <img src="images/story11.png" alt="The Musical Magic Makers" class="story-image">
                            <h3>The Musical Magic Makers!</h3>
                            <p>When a group of musical instruments come to life, they teach children about the power of harmony and how working together can create beautiful moments of joy.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Personal Growth</span>
                            <span class="story-tag">Creativity</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal12" data-category="growth">
                        <div class="story-content">
                            <img src="images/story12.png" alt="The Book Buddy Brigade" class="story-image">
                            <h3>The Book Buddy Brigade!</h3>
                            <p>When a group of books come to life, they help children discover the joy of reading and the magic of storytelling, teaching them that every book has a special adventure waiting to be explored.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Personal Growth</span>
                            <span class="story-tag">Creativity</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal13" data-category="family">
                        <div class="story-content">
                            <img src="images/story13.png" alt="The TV Time Team" class="story-image">
                            <h3>The TV Time Team!</h3>
                            <p>When a family's TV develops a personality of its own, it helps them learn about balance, family time, and the importance of choosing shows that bring everyone together.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Family Moments</span>
                            <span class="story-tag">Daily Kindness</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal14" data-category="random">
                        <div class="story-content">
                            <img src="images/story14.png" alt="The Exercise Energy Elves" class="story-image">
                            <h3>The Exercise Energy Elves!</h3>
                            <p>When a group of energetic elves take over a family's exercise equipment, they turn fitness into a fun adventure, teaching everyone that staying active can be exciting and enjoyable.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Random Acts</span>
                            <span class="story-tag">Health</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Story Modals -->
    <div class="modal fade" id="storyModal1" tabindex="-1" aria-labelledby="storyModal1Label" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="storyModal1Label">The Super Sparkle Family!</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story1.png" alt="The Super Sparkle Family" class="story-image">
                        <p>Papa and Nana had a special secret - they could create magical sparkles! These sparkles weren't just pretty to look at; they had the power to bring their family closer together.</p>
                        <p>One day, when Trinity was feeling sad, Papa and Nana's sparkles helped her find joy in making treats for Violet and Ella. When Elijah was struggling in the kitchen, the sparkles turned his cooking into a fun adventure. And when Reuel was working on a puzzle, the sparkles helped him see how each family member fit together perfectly.</p>
                        <p>The sparkles spread throughout the family, touching Mariah, Veronica, Ezra, Ian, Marisa, and little Lyra. Everyone discovered that they had their own special sparkle power - the power to spread love and kindness.</p>
                        <p>Together, the Super Sparkle Family learned that their greatest power wasn't in the sparkles themselves, but in how they used them to help and support each other. And that's how they became the most magical family in the world!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="storyModal2" tabindex="-1" aria-labelledby="storyModal2Label" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="storyModal2Label">Elijah's Kitchen of Culinary Craziness</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story2.png" alt="Elijah's Kitchen of Culinary Craziness" class="story-image">
                        <p>Elijah loved to cook, but sometimes his kitchen felt a bit lonely. That all changed one magical morning when his kitchen appliances came to life!</p>
                        <p>His blender started doing happy dances, his toaster told jokes, and his mixer sang songs while it worked. Even the refrigerator had a personality - it loved to keep things cool and organized.</p>
                        <p>With his new kitchen friends, cooking became an adventure. They helped him create special meals for the whole family - from Papa and Nana's favorite recipes to treats for his nieces and nephews.</p>
                        <p>Elijah learned that cooking wasn't just about making food - it was about creating joy and bringing the family together. And with his kitchen friends by his side, every meal became a celebration!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="storyModal3" tabindex="-1" aria-labelledby="storyModal3Label" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="storyModal3Label">Trinity's Teeny-Tiny Treat Fairies!</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story3.png" alt="Trinity's Teeny-Tiny Treat Fairies" class="story-image">
                        <p>Trinity's kitchen was special - it was home to a family of tiny treat fairies! These magical little creatures loved to help her create delicious surprises for her daughters, Violet and Ella.</p>
                        <p>The fairies would sprinkle their magic dust on cookies, add sparkle to cupcakes, and make sure every treat was made with extra love. They especially loved creating special birthday surprises and holiday treats.</p>
                        <p>Violet and Ella would watch in wonder as their mom and the fairies worked together. Sometimes, the fairies would even let the girls help, teaching them that the best treats are made with love and shared with family.</p>
                        <p>Together, Trinity and her fairy friends showed everyone that even the smallest gestures of kindness can bring the biggest smiles to the faces of those we love!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal6" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Sparkle Family's Giggle-Wiggle Kindness Calendar</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story6.png" alt="The Sparkle Family's Kindness Calendar" class="modal-image">
                    <p>The Sparkle Family wasn't just any regular family. Oh no! They had SPARKLY TOES that left tiny glitter trails wherever they walked. Even their pet goldfish, Bubbles, had sparkly fins that made the water look like a disco ball!</p>
                    <p>"What's our kindness mission today?" asked little Ezra, whose hair stood straight up like he'd been zapped by a tickle-monster. He was so excited that he accidentally did a somersault instead of walking.</p>
                    <p>"Share a toy day? That's BONKERS!" shouted Lyra, Ezra's sister, who was wearing her favorite tutu over her pajamas and had a spoon stuck to her nose just because she thought it was hilarious. "I'm going to share Mr. Squigglebottom with Ezra!" Mr. Squigglebottom was her stuffed octopus who wore eight different colored socks on his tentacles.</p>
                    <p>When Lyra handed Mr. Squigglebottom to Ezra, the calendar let out a GIGANTIC BURP! "EXCUSE ME!" it said, turning bright pink. Then it started giggling so hard that tiny gold stars popped out of its mouth and floated around the kitchen.</p>
                    <p>"Look, Mommy! The calendar is making star toots!" Ezra laughed so hard milk came out of his nose, which made everyone laugh even harder.</p>
                    <p>The next day was "Help a Friend Day," and the whole family helped their neighbor, Mrs. Pickle (who wasn't actually a pickle, but loved pickles so much she painted her house pickle-green). They helped her catch her runaway garden gnomes who had decided to have a mud-puddle party.</p>
                    <p>"Being kind is the SILLIEST, FUNNEST thing EVER!" declared Ezra as he watched the stars from the calendar chase the rainbow around the living room. And the whole Sparkle Family agreed—with a SUPER-DUPER group hug that was so powerful, it made their sparkly toes light up like tiny fireworks!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>A calendar with eyeballs that makes star toots and lays rainbow eggs!</p>
                        <h4>Life Lesson:</h4>
                        <p>Being kind is the silliest, funnest thing ever, and it makes everyone's day brighter!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal7" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Sparkle Family's Giggle-Wiggle Kindness Calendar</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story7.png" alt="The Sparkle Family's Giggle-Wiggle Kindness Calendar" class="modal-image">
                    <p>The Sparkle Family wasn't just any regular family. OH NO! They had SPARKLY TOES that left tiny glitter trails wherever they walked. Even their pet goldfish, Bubbles, had sparkly fins that made the water look like a disco ball!</p>
                    <p>Every morning, the Sparkle Family would check their special Kindness Calendar hanging in the kitchen. But this wasn't your ordinary, boring calendar with squares and numbers. NOPE! This calendar had EYEBALLS that blinked and a MOUTH that went "MWAH-MWAH-GOOD MORNING!" whenever someone touched it.</p>
                    <p>"What's our kindness mission today?" asked little Ezra, whose hair stood straight up like he'd been zapped by a tickle-monster. He was so excited that he accidentally did a somersault instead of walking.</p>
                    <p>"Share a toy day? That's BONKERS!" shouted Lyra, Ezra's sister, who was wearing her favorite tutu over her pajamas and had a spoon stuck to her nose just because she thought it was hilarious. "I'm going to share Mr. Squigglebottom with Ezra!" Mr. Squigglebottom was her stuffed octopus who wore eight different colored socks on his tentacles.</p>
                    <p>When Lyra handed Mr. Squigglebottom to Ezra, the calendar let out a GIGANTIC BURP! "EXCUSE ME!" it said, turning bright pink. Then it started giggling so hard that tiny gold stars popped out of its mouth and floated around the kitchen.</p>
                    <p>"Look, Mommy! The calendar is making star toots!" Ezra laughed so hard milk came out of his nose, which made everyone laugh even harder.</p>
                    <p>The next day was "Help a Friend Day," and the whole family helped their neighbor, Mrs. Pickle (who wasn't actually a pickle, but loved pickles so much she painted her house pickle-green). They helped her catch her runaway garden gnomes who had decided to have a mud-puddle party. The calendar was so impressed it did a backflip off the wall and then stuck itself back up.</p>
                    <p>By the time Wednesday rolled around—which was always "Super-Duper Hug Day"—the Sparkle Family was on a kindness roll! They gave hugs to everyone, including the mailman who was so surprised he accidentally delivered the neighbors' mail to a squirrel. The squirrel was very confused about what to do with all those bills!</p>
                    <p>The calendar was so happy it started doing the chicken dance and laid a golden egg that hatched into a tiny rainbow. The rainbow followed the Sparkle Family around all day, making "PFFFFFT" noises whenever someone walked through it.</p>
                    <p>"Being kind is the SILLIEST, FUNNEST thing EVER!" declared Ezra as he watched the stars from the calendar chase the rainbow around the living room. And the whole Sparkle Family agreed—with a SUPER-DUPER group hug that was so powerful, it made their sparkly toes light up like tiny fireworks!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>A talking calendar that burps stars and lays rainbow eggs!</p>
                        <h4>Life Lesson:</h4>
                        <p>Kindness is the sparkliest magic of all!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal8" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Family Fun Factory</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story8.png" alt="The Family Fun Factory" class="modal-image">
                    <p>In a house that looked like it had been painted by a rainbow with hiccups lived the Fun Factory Family. OH NO! They weren't called that because they made boring old toys. They were called the Fun Factory Family because they had a magical machine that could turn ANYTHING into fun!</p>
                    <p>It all started one rainy day when little Reuel was feeling as bored as a snail in a slow-motion race. "There's nothing to do," he sighed, looking at his pile of regular toys.</p>
                    <p>Suddenly, his toy box started to RUMBLE! "HOLY HAPPINESS HATS!" Reuel gasped. "My toy box is ALIVE!"</p>
                    <p>"Not just THIS toy box, fun-seeker!" the box giggled, sprouting tiny wheels and a party hat. "We're all alive! We're the FUN FACTORY TEAM, and we're here to make everything exciting!"</p>
                    <p>With a spin of its lid (which was actually a magical control panel), the toy box made ALL the toys come to life! Each one had its own special fun power:</p>
                    <p>There was Bouncy Betty the Ball, who could make anything bounce! Silly Sam the Stuffed Animal, who could make anything silly! And Dizzy Daisy the Doll, who could make anything dance!</p>
                    <p>"Watch THIS!" said Bouncy Betty, making the whole room start bouncing. "Fun isn't just about playing—it's about making everything BOUNCE with joy!"</p>
                    <p>Silly Sam started doing a silly dance, making everything turn into funny shapes! "Fun isn't just about games—it's about making everything SILLY!"</p>
                    <p>Dizzy Daisy pulled out a tiny disco ball and started making everything dance. "Fun isn't just about toys—it's about making everything DANCE!"</p>
                    <p>Reuel couldn't help but laugh. The toys were SO SILLY and SO FUN! Before he knew it, he was bouncing with the balls, being silly with the stuffed animals, and even having a mini dance party right there in his room!</p>
                    <p>The Fun Factory Team had special powers too! When someone was bored, they would create a fun storm to make them excited. When someone was sad, they would turn anything into a silly game. And when someone was tired, they would make everything dance to wake them up!</p>
                    <p>One day, Reuel's big sister Trinity came in, looking as grumpy as a thundercloud. "I don't WANT to have fun," she pouted, crossing her arms.</p>
                    <p>The Fun Factory Team had a plan! They created a magical fun bubble that made Trinity feel like she was floating on a cloud of happiness. Before she knew it, she was having so much fun she forgot she didn't want to play!</p>
                    <p>From that day on, the Fun Factory Team became the most popular fun experts in the neighborhood! They would help kids turn boring things into exciting adventures, make ordinary moments into magical ones, and even create new family traditions by mixing different types of fun together!</p>
                    <p>The best part was that the team taught Reuel that the best fun is the kind you share with your family! And that's exactly what the Fun Factory Team did every single day!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Toys that dance, bounce, and make everything a magical adventure!</p>
                        <h4>Life Lesson:</h4>
                        <p>Family fun is the best kind of fun!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal9" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Family Photo Frame Friends</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story9.png" alt="The Family Photo Frame Friends" class="modal-image">
                    <p>The family's photo frames weren't just regular, boring frames that held still pictures. OH NO! They were magical frames that could bring memories to life and make them dance right off the walls!</p>
                    <p>It all started one quiet afternoon when little Lyra was feeling as lonely as a cloud without a rainbow. "I wish I could play with my family photos," she sighed, looking at the pictures on the wall.</p>
                    <p>Suddenly, her favorite family photo started to SPARKLE! "HOLY MEMORY MAGIC!" Lyra gasped. "My photo is ALIVE!"</p>
                    <p>"Not just THIS photo, memory-maker!" the frame giggled, doing a happy dance. "We're all alive! We're the PHOTO FRAME FRIENDS, and we're here to make memories magical!"</p>
                    <p>With a wave of its frame (which was actually a magical wand), the photo made ALL the frames come to life! Each one had its own special memory power:</p>
                    <p>There was Memory Molly the Beach Frame, who could make beach days come alive! Vacation Vicky the Travel Frame, who could make trips feel real! And Birthday Benny the Party Frame, who could make celebrations sparkle!</p>
                    <p>"Watch THIS!" said Memory Molly, making ocean waves splash out of her frame. "Memories aren't just about looking—they're about FEELING the moment!"</p>
                    <p>Vacation Vicky started doing a travel dance, making suitcases float around the room! "Memories aren't just about photos—they're about LIVING the adventure!"</p>
                    <p>Birthday Benny pulled out a tiny party hat and started making balloons pop out of his frame. "Memories aren't just about pictures—they're about CELEBRATING the fun!"</p>
                    <p>Lyra couldn't help but smile. The frames were SO SILLY and SO FUN! Before she knew it, she was splashing with the beach memories, traveling with the vacation photos, and even having a mini birthday party right there in her room!</p>
                    <p>The Photo Frame Friends had special powers too! When someone was lonely, they would create a memory storm to make them feel loved. When someone was sad, they would turn any photo into a happy moment. And when someone was missing family, they would make memories feel real!</p>
                    <p>One day, Lyra's big brother Ezra came in, looking as grumpy as a thundercloud. "I don't WANT to look at old photos," he pouted, crossing his arms.</p>
                    <p>The Photo Frame Friends had a plan! They created a magical memory bubble that made Ezra feel like he was right back in his favorite family moment. Before he knew it, he was having so much fun he forgot he didn't want to remember!</p>
                    <p>From that day on, the Photo Frame Friends became the most popular memory experts in the neighborhood! They would help kids bring their favorite moments to life, turn ordinary photos into magical adventures, and even create new family traditions by mixing different types of memories together!</p>
                    <p>The best part was that the friends taught Lyra that the best memories are the ones you share with your family! And that's exactly what the Photo Frame Friends did every single day!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Photo frames that dance, splash, and make memories come alive!</p>
                        <h4>Life Lesson:</h4>
                        <p>Family memories are the most magical moments of all!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal10" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Family Tech Team</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story10.png" alt="The Family Tech Team" class="modal-image">
                    <p>The family's tech gadgets weren't just regular, boring devices that sat on shelves. OH NO! They were magical machines that could turn screen time into family time and make learning as fun as a game of hide-and-seek!</p>
                    <p>It all started one quiet evening when little Max was feeling as bored as a robot without batteries. "I wish I could play with my family on my tablet," he sighed, looking at his screen.</p>
                    <p>Suddenly, his tablet started to SPARKLE! "HOLY TECH MAGIC!" Max gasped. "My tablet is ALIVE!"</p>
                    <p>"Not just THIS tablet, tech-explorer!" the device giggled, doing a happy dance. "We're all alive! We're the TECH TEAM, and we're here to make learning magical!"</p>
                    <p>With a wave of its screen (which was actually a magical portal), the tablet made ALL the gadgets come to life! Each one had its own special tech power:</p>
                    <p>There was Tablet Tina the Learning Frame, who could make lessons come alive! Computer Charlie the Adventure Frame, who could make games feel real! And Phone Phil the Party Frame, who could make calls sparkle!</p>
                    <p>"Watch THIS!" said Tablet Tina, making educational videos dance off the screen. "Learning isn't just about watching—it's about DOING the fun!"</p>
                    <p>Computer Charlie started doing a game dance, making virtual worlds float around the room! "Learning isn't just about screens—it's about PLAYING the adventure!"</p>
                    <p>Phone Phil pulled out a tiny camera and started making family calls feel like magic. "Learning isn't just about devices—it's about SHARING the fun!"</p>
                    <p>Max couldn't help but smile. The gadgets were SO SILLY and SO FUN! Before he knew it, he was learning with the tablet, playing with the computer, and even having a mini family video call right there in his room!</p>
                    <p>The Tech Team had special powers too! When someone was bored, they would create a learning storm to make them excited. When someone was sad, they would turn any app into a happy game. And when someone was missing family, they would make video calls feel real!</p>
                    <p>One day, Max's big sister Zoe came in, looking as grumpy as a thundercloud. "I don't WANT to learn on screens," she pouted, crossing her arms.</p>
                    <p>The Tech Team had a plan! They created a magical learning bubble that made Zoe feel like she was right in the middle of an exciting adventure. Before she knew it, she was having so much fun she forgot she didn't want to learn!</p>
                    <p>From that day on, the Tech Team became the most popular learning experts in the neighborhood! They would help kids turn screen time into family time, make ordinary apps into magical adventures, and even create new family traditions by mixing different types of learning together!</p>
                    <p>The best part was that the team taught Max that the best learning is the kind you share with your family! And that's exactly what the Tech Team did every single day!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Tech gadgets that dance, learn, and make screen time magical!</p>
                        <h4>Life Lesson:</h4>
                        <p>Family learning is the most fun kind of learning!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal11" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Musical Magic Makers!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story11.png" alt="The Musical Magic Makers" class="story-image">
                    <p>Mariah's instruments weren't just regular, boring instruments that sat around collecting dust. OH NO! They were MAGICAL MUSIC MAKERS with personalities bigger than a tuba wearing a tutu!</p>
                    <p>It all started one rainy Tuesday when Mariah was feeling as gloomy as a penguin who lost his umbrella. She sat down at her piano, which usually just went "plink-plonk" like any old piano. But today, something AMAZING happened!</p>
                    <p>The piano keys started wiggling like they were doing the hokey-pokey! Then, without anyone touching them, they started playing the HAPPIEST song you ever heard—a tune that sounded like a bunch of giggling giraffes playing hopscotch!</p>
                    <p>"HOLY MUSICAL MACARONI!" Mariah shouted, jumping so high she almost hit the ceiling. "My piano is ALIVE!"</p>
                    <p>The piano did a little spin on its wheels and said in a voice that sounded like it had swallowed a music box, "I've ALWAYS been alive, you silly goose! I just needed someone who would play me with their HEART!"</p>
                    <p>Soon, all of Mariah's instruments came to life! Her guitar started strumming itself, playing songs that made the flowers in the vase dance. The drums would beat out rhythms that made the furniture bounce around the room like it was at a party. And the tambourine? OH BOY! That tambourine was the SILLIEST of all, shaking itself so hard it would do backflips across the room!</p>
                    <p>One day, Mariah's little brother Tommy was feeling sad because his pet rock (named Rocky) had rolled away and gotten lost. The instruments decided to help! The piano played a "Finding Rocky" song, the guitar strummed a "Don't Worry" tune, and the drums beat out a "Rock and Roll" rhythm that made everyone dance.</p>
                    <p>And guess what? The music was so magical that Rocky the rock started rolling back home, doing somersaults all the way! He even had a tiny bow tie on that he must have found somewhere.</p>
                    <p>From that day on, Mariah's instruments became the happiest band in the world! They would play lullabies to help babies sleep, wake-up songs that made everyone jump out of bed doing cartwheels, and even special "Homework Helper" tunes that made math problems solve themselves!</p>
                    <p>The best part was that the instruments taught Mariah that music isn't just about playing the right notes—it's about playing with your HEART and making others happy! And that's exactly what her magical musical friends did every single day!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Instruments that play themselves and make furniture dance!</p>
                        <h4>Life Lesson:</h4>
                        <p>Music can bring joy and comfort to everyone around you!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal12" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Book Buddy Brigade!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story12.png" alt="The Book Buddy Brigade" class="modal-image">
                    <p>Veronica's books weren't just regular, boring books that sat on shelves collecting dust. NO WAY! They were a BRIGADE of BOOK BUDDIES who loved to JUMP, DANCE, and tell the SILLIEST stories you ever heard!</p>
                    <p>It all started one quiet afternoon when Veronica was reading her favorite story about a dragon who loved to knit sweaters for penguins. Suddenly, the book started WIGGLING in her hands like it had the GIGGLES!</p>
                    <p>"EXCUSE ME!" said the book in a voice that sounded like it had been drinking fizzy water. "But I think it's time for a DANCE BREAK!"</p>
                    <p>Before Veronica could say "HOLY BOOKWORM!" the book JUMPED out of her hands and started doing the cha-cha across the floor! Its pages flapped like wings, and the dragon from the story POPPED right out of the book, wearing a tiny pink tutu and knitting needles!</p>
                    <p>Soon, ALL the books in Veronica's room came to life! The picture books made their characters dance across the walls, the storybooks created magical worlds right in the living room, and the cookbooks made the recipes float around the kitchen like delicious-smelling butterflies!</p>
                    <p>The dictionary was the FUNNIEST of all! It would open itself up and shoot out words that turned into real things! One time it shot out the word "rainbow" and suddenly there was a rainbow in the living room! Another time it shot out "popcorn" and it started raining popcorn!</p>
                    <p>One day, Veronica's friend Sarah was feeling sad because she couldn't figure out her math homework. The books decided to help! The math book turned its numbers into dancing robots, the science book made the planets orbit around Sarah's head, and the history book brought famous inventors to life to help solve the problems!</p>
                    <p>Sarah was so amazed that she forgot to be sad! The books had turned learning into the most FUN adventure ever! They even made a special "Homework Helper" song that went:</p>
                    <p>"Numbers and letters, they're all your friends!<br>
                    They'll help you learn until the day ends!<br>
                    So open a book and take a look,<br>
                    At all the magic in every nook!"</p>
                    <p>From that day on, Veronica's books became the most popular friends in the neighborhood! They would help kids with their homework, tell bedtime stories that made everyone laugh, and even create magical adventures right in the living room!</p>
                    <p>The best part was that the books taught Veronica that reading isn't just about words on a page—it's about using your IMAGINATION to make the stories come alive! And that's exactly what her book buddies did every single day!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Books that dance and shoot out rainbows and popcorn!</p>
                        <h4>Life Lesson:</h4>
                        <p>Books can be your best friends and take you on amazing adventures!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal13" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The TV Time Team!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story13.png" alt="The TV Time Team" class="modal-image">
                    <p>Reuel's TV remote wasn't just any old boring remote that sat on the couch collecting cookie crumbs. OH NO! It was a MAGICAL REMOTE with a personality bigger than a popcorn machine at a movie theater!</p>
                    <p>It all started one Saturday morning when Reuel was trying to find a show to watch. The remote suddenly started GLOWING like it had swallowed a rainbow! Then it started TALKING in a voice that sounded like it had been eating too many marshmallows!</p>
                    <p>"EXCUSE ME!" said the remote, doing a little dance on the coffee table. "But I think you need something more EXCITING than cartoons about talking vegetables!"</p>
                    <p>Before Reuel could say "HOLY CHANNEL SURFING!" the remote started zapping the TV with magical beams of light! The screen started showing the most AMAZING shows—ones that weren't even on regular TV!</p>
                    <p>There was a cooking show where the food would JUMP out of the screen and do the cha-cha! A nature show where the animals would tell jokes (the penguins were especially funny)! And a science show where the experiments would create tiny rainbows that floated around the living room!</p>
                    <p>The remote had a special way of knowing exactly what everyone wanted to watch. When Reuel's little sister was sad, it would show shows about friendship that made her smile. When Dad was tired from work, it would find the funniest comedies that made him laugh until his belly hurt!</p>
                    <p>One day, Reuel's whole family was arguing about what to watch. Mom wanted a cooking show, Dad wanted sports, and Reuel's sister wanted cartoons. The remote had a BRILLIANT idea! It started GLOWING SUPER BRIGHT and created a magical show that combined ALLtheir favorites!</p>
                    <p>The show had cooking sports commentators who made food while doing backflips, cartoon characters playing basketball with giant meatballs, and a halftime show where the chefs would do synchronized swimming in a pool of chocolate pudding!</p>
                    <p>Everyone was so amazed that they forgot to argue! They spent the whole evening laughing and enjoying the most CRAZY, FUN show they'd ever seen!</p>
                    <p>From that day on, the remote became the family's favorite TV buddy. It would wake them up with morning shows that made their breakfast dance, help them learn new things with magical educational programs, and even create special shows just for family movie night!</p>
                    <p>The best part was that the remote taught Reuel that watching TV isn't just about sitting and staring—it's about sharing fun moments with the people you love! And that's exactly what his magical remote friend did every single day!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>A talking remote that creates shows with dancing food and swimming chefs!</p>
                        <h4>Life Lesson:</h4>
                        <p>Sharing entertainment with family can create the most magical moments!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal14" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Exercise Energy Elves!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story14.png" alt="The Exercise Energy Elves" class="modal-image">
                    <p>Ezra's exercise equipment wasn't just regular, boring equipment that sat in the corner collecting dust. OH NO! It was home to the most ENERGETIC, ENTHUSIASTIC team of tiny elves you ever did see!</p>
                    <p>It all started one Monday morning when Ezra was feeling as lazy as a sloth who'd eaten too many marshmallows. He looked at his exercise mat and sighed. "Exercise is BORING," he mumbled, flopping onto the couch like a pancake.</p>
                    <p>Suddenly, a tiny voice piped up from the exercise mat! "BORING? BORING? We'll show you BORING!"</p>
                    <p>Ezra's eyes popped open wider than a pizza box! There, standing on his mat, was a tiny elf wearing a sparkly leotard and a headband that said "ENERGY BOSS" in glitter letters!</p>
                    <p>"HOLY JUMPING JELLYBEANS!" Ezra shouted, nearly falling off the couch. "There's an elf on my exercise mat!"</p>
                    <p>"Not just ONE elf, silly!" the elf giggled, doing a perfect cartwheel. "We're the EXERCISE ENERGY ELVES, and we're here to make fitness FUN!"</p>
                    <p>With a snap of her tiny fingers, the mat started to GLOW! Suddenly, dozens of elves popped up everywhere—on the dumbbells, the jump rope, even the yoga ball! Each elf was wearing a different exercise outfit and had a different job:</p>
                    <p>There was Jumping Jack Jill, who made every jump feel like you were bouncing on a cloud! Push-up Pete, who turned push-ups into a game of "Floor is Lava"! And Running Rita, who made running in place feel like you were racing through a magical forest!</p>
                    <p>"Watch THIS!" said Jumping Jack Jill, doing a series of jumps so fast she looked like a blur of sparkles. "Jumping jacks aren't just up and down—they're a DANCE PARTY for your body!"</p>
                    <p>Push-up Pete pulled out a tiny megaphone and announced, "Push-ups are just high-fives with the floor! And who doesn't love high-fives?"</p>
                    <p>Running Rita started doing laps around the room, leaving a trail of rainbow footprints. "Running is just skipping with extra bounces!" she called out, doing a perfect backflip.</p>
                    <p>Ezra couldn't help but laugh. The elves were SO SILLY and SO FUN! Before he knew it, he was joining in—jumping like a kangaroo, doing push-ups while making funny faces, and running in place while pretending to be a superhero!</p>
                    <p>The elves had special powers too! When Ezra got tired, they would sprinkle "Energy Sparkles" that made him feel like he could run a marathon! When he got bored, they would turn the exercise into a game—like "Dodge the Invisible Dragons" or "Balance Like a Flamingo"!</p>
                    <p>One day, Ezra's little sister Lily came in, looking as grumpy as a cat who'd lost its favorite toy. "I don't WANT to exercise," she pouted, crossing her arms.</p>
                    <p>The elves had a plan! They turned the exercise mat into a magical dance floor, complete with disco lights and music that sounded like a mix of pop songs and giggling! Lily couldn't resist—she started dancing, and soon she was having so much fun she forgot she was exercising!</p>
                    <p>From that day on, the Exercise Energy Elves became the most popular fitness team in the neighborhood! They would help kids with their PE homework, turn boring warm-ups into exciting adventures, and even create special "Family Fitness Fun" routines that made everyone laugh!</p>
                    <p>The best part was that the elves taught Ezra that exercise isn't just about being healthy—it's about having FUN and feeling good! And that's exactly what his energetic elf friends did every single day!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Tiny elves that turn exercise into a magical dance party!</p>
                        <h4>Life Lesson:</h4>
                        <p>Exercise can be fun when you use your imagination and find joy in movement!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal15" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Photo Frame Friends!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story15.png" alt="The Photo Frame Friends" class="modal-image">
                    <p>The family's photo frames weren't just regular, boring frames that hung on the wall doing NOTHING all day. OH NO! They were a big, happy family of FRAME FRIENDS who loved to share their favorite memories and tell the SILLIEST stories!</p>
                    <p>It all started one rainy afternoon when little Lyra was feeling as gloomy as a cloud who'd lost its rain. She looked at the family photos on the wall and sighed. "I wish I could go back to the beach vacation," she mumbled, thinking about the fun they'd had building sandcastles.</p>
                    <p>Suddenly, the beach photo frame started to WIGGLE! "Well, why don't you?" asked a voice that sounded like waves crashing on the shore.</p>
                    <p>Lyra's eyes popped open wider than a camera lens! The photo frame had grown a tiny pair of sunglasses and was doing a little hula dance! "HOLY SNAPPING SHUTTERS!" she gasped. "The frame is ALIVE!"</p>
                    <p>"Not just THIS frame, silly!" the beach frame giggled, doing a perfect backflip. "We're all alive! We're the PHOTO FRAME FRIENDS, and we're here to make memories come alive!"</p>
                    <p>With a flash of light, ALL the frames on the wall came to life! Each frame had its own personality and special power:</p>
                    <p>There was Birthday Bash Betty, who could make the candles on birthday cakes actually flicker! Vacation Vinnie, who could make the waves in beach photos splash right out of the frame! And Family Fun Frank, who could make everyone in family photos wave and say hello!</p>
                    <p>"Watch THIS!" said Birthday Bash Betty, making the candles on her cake photo glow and sparkle. "Birthday memories aren't just pictures—they're CELEBRATIONS frozen in time!"</p>
                    <p>Vacation Vinnie started doing the wave, making the ocean in his photo splash right onto Lyra's nose! "Beach memories aren't just photos—they're mini-vacations you can visit anytime!"</p>
                    <p>Family Fun Frank pulled out a tiny conductor's baton and made everyone in his photo do a synchronized dance. "Family photos aren't just pictures—they're HAPPY MOMENTS that last forever!"</p>
                    <p>Lyra couldn't help but laugh. The frames were SO SILLY and SO FUN! Before she knew it, she was dancing with the photos, making funny faces with the people in them, and even having a mini beach party right there in her room!</p>
                    <p>The frames had special powers too! When Lyra was sad, they would show her favorite happy memories. When she was bored, they would create new adventures by mixing different photos together—like putting the beach background behind a birthday party photo!</p>
                    <p>One day, Lyra's little brother Ezra came in, looking as grumpy as a camera with a dead battery. "I don't WANT to look at old photos," he pouted, crossing his arms.</p>
                    <p>The frames had a plan! They created a magical photo slideshow that made the pictures come to life in 3D! Ezra couldn't resist—he started pointing at the floating images, and soon he was having so much fun he forgot he was looking at "old" photos!</p>
                    <p>From that day on, the Photo Frame Friends became the most popular memory keepers in the neighborhood! They would help kids remember special moments, turn boring photo albums into exciting adventures, and even create new memories by combining different photos in magical ways!</p>
                    <p>The best part was that the frames taught Lyra that memories aren't just pictures on a wall—they're magical moments that can make you smile anytime! And that's exactly what her frame friends did every single day!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Photo frames that dance, splash, and make memories come alive!</p>
                        <h4>Life Lesson:</h4>
                        <p>Family memories are precious treasures that can bring joy and laughter anytime!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal16" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Bedtime Book Buddies!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story16.png" alt="The Bedtime Book Buddies" class="modal-image">
                    <p>Every night, when the moon was high and the stars were twinkling like tiny flashlights, something MAGICAL happened in little Noah's bedroom. His books would wake up from their daytime naps and become his very own BEDTIME BOOK BUDDIES!</p>
                    <p>It all started one night when Noah was having trouble falling asleep. "I'm not sleepy at ALL!" he declared, bouncing on his bed like a kangaroo on a trampoline.</p>
                    <p>Suddenly, his favorite storybook started to GLOW! The cover opened by itself, and out popped a tiny wizard wearing a nightcap made of pages! "HOLY FLYING PAGES!" Noah gasped. "My book is ALIVE!"</p>
                    <p>"Not just THIS book, sleepyhead!" the wizard giggled, doing a perfect somersault. "We're all alive! We're the BEDTIME BOOK BUDDIES, and we're here to make bedtime the most magical time of day!"</p>
                    <p>With a wave of his wand (which was actually a bookmark), the wizard made ALL the books on Noah's shelf come to life! Each book had its own special bedtime power:</p>
                    <p>There was Dreamy Dora the Dinosaur, who could make the room feel as cozy as a dinosaur's nest! Sleepy Sam the Spaceman, who could turn the ceiling into a twinkling galaxy! And Lullaby Lucy the Lion, who could sing the sweetest bedtime songs!</p>
                    <p>"Watch THIS!" said Dreamy Dora, making the room fill with soft, warm light. "Bedtime isn't just about sleeping—it's about feeling SAFE and SNUGGLY!"</p>
                    <p>Sleepy Sam started floating around the room, leaving trails of starlight behind him. "Bedtime isn't just about closing your eyes—it's about DREAMING of amazing adventures!"</p>
                    <p>Lullaby Lucy pulled out a tiny harp made of book pages and started singing a gentle lullaby. "Bedtime isn't just about being quiet—it's about feeling PEACEFUL and HAPPY!"</p>
                    <p>Noah couldn't help but yawn. The books were SO CALMING and SO COZY! Before he knew it, he was snuggled under his blanket, listening to the gentle stories and feeling sleepier by the minute!</p>
                    <p>The books had special bedtime routines too! They would create a magical atmosphere by making the room glow with soft colors, floating stars would dance around the ceiling, and gentle music would play from the pages of the storybooks!</p>
                    <p>One night, Noah's little sister Mia came in, looking as wide awake as an owl at midnight. "I'm not tired!" she declared, doing cartwheels across the room.</p>
                    <p>The Book Buddies had a plan! They created a magical story that made Mia feel like she was floating on a cloud. Before she knew it, she was yawning and snuggling up with her favorite teddy bear!</p>
                    <p>From that night on, the Bedtime Book Buddies became the most popular sleep helpers in the neighborhood! They would help kids drift off to dreamland, turn bedtime into an adventure, and even create special dreams by mixing different stories together!</p>
                    <p>The best part was that the books taught Noah that bedtime isn't just about sleeping—it's about having magical moments with your favorite stories! And that's exactly what his Book Buddies did every single night!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Books that come alive at bedtime to create magical sleep adventures!</p>
                        <h4>Life Lesson:</h4>
                        <p>Bedtime can be a special time for peaceful moments and sweet dreams!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal17" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Pet Tech Team!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story17.png" alt="The Pet Tech Team" class="modal-image">
                    <p>When the family's pets discover they can use technology to help others, they form a special team that spreads joy and kindness through their unique abilities.</p>
                </div>
                <div class="story-tags">
                    <span class="story-tag">Family Moments</span>
                    <span class="story-tag">Innovation</span>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal18" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Laundry Day Llamas!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story18.png" alt="The Laundry Day Llamas" class="modal-image">
                    <p>The family's washing machine had a special team of laundry llamas! They would fold clothes into origami shapes, make socks dance, and turn laundry day into a fashion show. The llamas loved making laundry fun and helping keep everyone's clothes clean and happy!</p>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal19" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Garden Growth Gang!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story19.png" alt="The Garden Growth Gang" class="modal-image">
                    <p>The family's garden wasn't just a regular, quiet patch of dirt with plants. OH NO! It was a magical place where the GARDEN GROWTH GANG lived, making sure every seed grew into something special and every flower bloomed with joy!</p>
                    <p>It all started one spring morning when little Lyra was planting her first sunflower seed. "I hope it grows big and tall," she whispered, carefully covering the seed with soil.</p>
                    <p>Suddenly, the soil started to WIGGLE! A tiny sprout popped up, wearing a pair of sunglasses made of leaves! "HOLY GROWING GARDENS!" Lyra gasped. "The plants are ALIVE!"</p>
                    <p>"Not just THIS plant, green thumb!" the sprout giggled, doing a perfect leaf-flip. "We're all alive! We're the GARDEN GROWTH GANG, and we're here to make gardening the most magical activity ever!"</p>
                    <p>With a wave of its leaf (which was actually a tiny watering can), the sprout made ALL the plants in the garden come to life! Each plant had its own special power:</p>
                    <p>There was Blooming Betty the Butterfly Bush, who could make flowers dance in the breeze! Sprouting Sam the Sunflower, who could make seeds grow super fast! And Watering Wendy the Water Lily, who could make rainbows appear when it rained!</p>
                    <p>"Watch THIS!" said Blooming Betty, making the flowers form a conga line. "Gardening isn't just about planting—it's about watching life GROW and BLOOM!"</p>
                    <p>Sprouting Sam started doing a growth dance, making tiny seeds sprout into big plants! "Gardening isn't just about waiting—it's about seeing the magic of nature!"</p>
                    <p>Watering Wendy pulled out a tiny umbrella and started making it rain sparkles. "Gardening isn't just about watering—it's about creating a beautiful world!"</p>
                    <p>Lyra couldn't help but laugh. The plants were SO SILLY and SO FUN! Before she knew it, she was dancing with the flowers, singing with the sunflowers, and even having a mini garden party right there in the dirt!</p>
                    <p>The plants had special powers too! When a seed was sad, they would sing it a growing song. When a flower was droopy, they would give it a magical boost. And when a plant was lonely, they would introduce it to new garden friends!</p>
                    <p>One day, Lyra's little brother Ezra came in, looking as grumpy as a weed that had been pulled. "I don't WANT to garden," he pouted, kicking at the dirt.</p>
                    <p>The Garden Growth Gang had a plan! They created a magical garden that made Ezra feel like he was in a jungle adventure. Before he knew it, he was having so much fun he forgot he didn't want to garden!</p>
                    <p>From that day on, the Garden Growth Gang became the most popular plant helpers in the neighborhood! They would help kids grow their own gardens, turn boring yards into magical places, and even create new plants by mixing different seeds together!</p>
                    <p>The best part was that the plants taught Lyra that gardening isn't just about growing things—it's about watching the magic of nature happen right before your eyes! And that's exactly what her Garden Growth Gang did every single day!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Plants that dance, sing, and make gardening a magical adventure!</p>
                        <h4>Life Lesson:</h4>
                        <p>Gardening teaches us about patience, growth, and the magic of nature!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal20" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Family Fun Factory!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story20.png" alt="The Family Fun Factory" class="modal-image">
                    <p>The family's house wasn't just a regular, boring place to live. OH NO! It was a magical FAMILY FUN FACTORY where every room could transform into an exciting adventure and every day was filled with laughter and joy!</p>
                    <p>It all started one Saturday morning when little Ezra was feeling as bored as a toy that had lost its batteries. "There's nothing to do," he sighed, looking around the living room.</p>
                    <p>Suddenly, the TV remote started to DANCE! It sprouted tiny arms and legs and began doing the robot! "HOLY FUN FACTORY!" Ezra gasped. "The house is ALIVE!"</p>
                    <p>"Not just THIS room, fun-seeker!" the remote giggled, doing a perfect backflip. "We're all alive! We're the FAMILY FUN FACTORY, and we're here to turn every day into an adventure!"</p>
                    <p>With a press of its buttons, the remote made ALL the rooms in the house come to life! Each room had its own special power:</p>
                    <p>There was Playful Patty the Playroom, who could turn toys into real-life adventures! Kitchen King Karl, who could make cooking a magical experience! And Bedroom Buddy Bella, who could transform bedtime into a dreamy journey!</p>
                    <p>"Watch THIS!" said Playful Patty, making the toys come alive and start a parade. "Family time isn't just about playing—it's about creating MEMORIES together!"</p>
                    <p>Kitchen King Karl started doing a cooking dance, making ingredients float and dance in the air! "Family time isn't just about eating—it's about sharing JOY and LAUGHTER!"</p>
                    <p>Bedroom Buddy Bella pulled out a tiny wand and started making stars twinkle on the ceiling. "Family time isn't just about sleeping—it's about feeling SAFE and LOVED!"</p>
                    <p>Ezra couldn't help but laugh. The rooms were SO SILLY and SO FUN! Before he knew it, he was dancing with the toys, cooking with floating ingredients, and even having a mini family party right there in the living room!</p>
                    <p>The rooms had special powers too! When someone was sad, they would create a fun activity to cheer them up. When someone was bored, they would transform into an exciting adventure. And when someone was lonely, they would bring the whole family together for a special moment!</p>
                    <p>One day, Ezra's little sister Lyra came in, looking as grumpy as a cloud on a sunny day. "I don't WANT to play with the family," she pouted, crossing her arms.</p>
                    <p>The Family Fun Factory had a plan! They created a magical family game that made Lyra feel like she was the star of the show. Before she knew it, she was having so much fun she forgot she didn't want to play!</p>
                    <p>From that day on, the Family Fun Factory became the most popular house in the neighborhood! They would help families have fun together, turn boring days into exciting adventures, and even create new family traditions by mixing different activities together!</p>
                    <p>The best part was that the house taught Ezra that family time isn't just about being together—it's about creating magical moments that make everyone smile! And that's exactly what his Family Fun Factory did every single day!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Rooms that dance, sing, and turn family time into a magical adventure!</p>
                        <h4>Life Lesson:</h4>
                        <p>Family time is about creating memories and sharing joy together!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="storyModal4" tabindex="-1" aria-labelledby="storyModal4Label" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="storyModal4Label">Reuel's Wacky Puzzle Family!</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story4.png" alt="Reuel's Wacky Puzzle Family" class="story-image">
                        <p>Reuel loved puzzles, but he never expected his puzzle pieces to come to life! Each piece represented a member of his family, and they all had their own personalities.</p>
                        <p>There was Papa and Nana's piece, strong and wise. Trinity's piece was creative and kind, while Mariah's piece was full of energy. Veronica's piece brought laughter, and Elijah's piece was always cooking up new ideas.</p>
                        <p>Ezra's piece was thoughtful and quiet, while Ian's piece was full of adventure. Marisa's piece brought beauty to everything, and little Lyra's piece was the sparkle that made everything complete.</p>
                        <p>As Reuel put the puzzle together, he discovered that each piece was unique and important. Just like in his real family, every piece fit together perfectly to create a beautiful picture of love and support!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="storyModal5" tabindex="-1" aria-labelledby="storyModal5Label" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="storyModal5Label">The Super-Sticky Hug Team!</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story5.png" alt="The Super-Sticky Hug Team" class="story-image">
                        <p>Papa and Nana had a special power - their hugs were so full of love that they stuck with you forever! When they hugged someone, a little bit of their love magic would stay with them, helping them through any challenge.</p>
                        <p>Their hugs helped Trinity find strength when she needed it most, gave Elijah confidence in the kitchen, and helped Reuel solve his trickiest puzzles. The magic spread to Mariah, Veronica, Ezra, Ian, Marisa, and little Lyra too!</p>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.js"></script>
    <script>
        AOS.init({
            duration: 1000,
            once: true
        });

        // Store all original story cards to use for filtering
        let allStoryCards = [];
        
        // Handle image loading errors
        document.querySelectorAll('.story-image, .modal-image').forEach(img => {
            img.onerror = function() {
                this.classList.add('error');
                this.alt = 'Image not available';
                this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23FF6B6B"/><text x="50" y="50" font-family="Arial" font-size="12" fill="white" text-anchor="middle" dy=".3em">Image not available</text></svg>';
            };
        });

        // Initialize all modals
        const modals = document.querySelectorAll('.story-modal');
        modals.forEach(modal => {
            const modalInstance = new bootstrap.Modal(modal);
            
            // Handle modal closing
            modal.addEventListener('hidden.bs.modal', function () {
                document.querySelectorAll('.story-card.active').forEach(card => {
                    card.classList.remove('active');
                });
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            });
        });

        // Handle story card clicks
        document.querySelectorAll('.story-card').forEach(card => {
            card.addEventListener('click', function() {
                const modalId = this.getAttribute('data-bs-target');
                const modal = document.querySelector(modalId);
                if (modal) {
                    const modalInstance = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
                    modalInstance.show();
                }
            });
        });

        // Function to filter and display stories
        function filterStories(category) {
            // Get the container to add stories to
            const container = document.querySelector('.stories-section .container');
            
            // Get all story cards if we haven't stored them yet
            if (allStoryCards.length === 0) {
                allStoryCards = Array.from(document.querySelectorAll('.story-card')).map(card => card.cloneNode(true));
            }
            
            // Clear existing rows
            const rows = document.querySelectorAll('.stories-section .row');
            rows.forEach(row => row.remove());

            // Create new rows
            let currentRow = document.createElement('div');
            currentRow.className = 'row';
            container.appendChild(currentRow);
            let colCount = 0;

            // Filter and display stories
            const filteredCards = allStoryCards.filter(card => 
                category === 'all' || card.getAttribute('data-category') === category
            );
            
            filteredCards.forEach((card, index) => {
                if (colCount === 3) {
                    currentRow = document.createElement('div');
                    currentRow.className = 'row mt-4';
                    container.appendChild(currentRow);
                    colCount = 0;
                }

                const col = document.createElement('div');
                col.className = 'col-md-4';
                col.setAttribute('data-aos', 'fade-up');
                col.setAttribute('data-aos-delay', (index % 3 + 1) * 100);
                
                // Clone the card to avoid DOM issues
                const cardClone = card.cloneNode(true);
                
                // Re-attach click handler to the cloned card
                cardClone.addEventListener('click', function() {
                    const modalId = this.getAttribute('data-bs-target');
                    const modal = document.querySelector(modalId);
                    if (modal) {
                        const modalInstance = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
                        modalInstance.show();
                    }
                });
                
                col.appendChild(cardClone);
                currentRow.appendChild(col);
                colCount++;
            });

            // Reinitialize AOS
            AOS.refresh();
            
            // Show a message if no stories match the filter
            if (filteredCards.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'col-12 text-center mt-5';
                emptyMessage.innerHTML = '<h3>No stories found for this category.</h3><p>Please select another category.</p>';
                currentRow.appendChild(emptyMessage);
            }
        }

        // Handle category filtering
        document.querySelectorAll('.story-navigation .nav-item').forEach(item => {
            item.addEventListener('click', function() {
                const category = this.getAttribute('data-category');
                
                // Update active state in navigation
                document.querySelectorAll('.story-navigation .nav-item').forEach(navItem => {
                    navItem.classList.remove('active');
                });
                this.classList.add('active');
                
                // Filter stories
                filterStories(category);
            });
        });

        // Store original stories and initialize display
        document.addEventListener('DOMContentLoaded', function() {
            // Get original story cards
            allStoryCards = Array.from(document.querySelectorAll('.story-card')).map(card => card.cloneNode(true));
            // Initial display
            filterStories('all');
        });
    </script>
</body>
</html> 