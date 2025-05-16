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
            padding: 8rem 0 4rem;
            position: relative;
            overflow: hidden;
        }

        .hero h1 {
            font-size: 3.5rem;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }

        .hero p {
            font-size: 1.5rem;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
        }

        .stories-section {
            padding: 5rem 0;
            background: var(--light-color);
        }

        .story-card {
            background: white;
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: all 0.5s ease;
            cursor: pointer;
            border: 3px solid transparent;
            position: relative;
            overflow: hidden;
        }

        .story-card:hover {
            transform: translateY(-10px) scale(1.02);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            border-color: var(--accent-color);
        }

        .story-image {
            width: 100%;
            height: 200px;
            object-fit: cover;
            border-radius: 15px;
            margin-bottom: 1rem;
            border: 3px solid var(--accent-color);
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

        .story-tag {
            display: inline-block;
            padding: 0.5rem 1rem;
            background: var(--accent-color);
            color: var(--dark-color);
            border-radius: 20px;
            font-size: 1rem;
            margin-right: 0.5rem;
            margin-bottom: 0.5rem;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
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

    <div class="story-navigation">
        <div class="nav-item active" data-category="all">All Stories</div>
        <div class="nav-item" data-category="family">Family Moments</div>
        <div class="nav-item" data-category="community">Community</div>
        <div class="nav-item" data-category="random">Random Acts</div>
        <div class="nav-item" data-category="growth">Personal Growth</div>
        <div class="nav-item" data-category="daily">Daily Kindness</div>
    </div>

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

    <section class="stories-section">
        <div class="container">
            <div class="row">
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal1">
                        <img src="images/story1.png" alt="The Super Sparkle Family" class="story-image">
                        <h3>The Super Sparkle Family!</h3>
                        <p>Based on The Graves Family Legacy</p>
                        <div class="story-tags">
                            <span class="story-tag">Family</span>
                            <span class="story-tag">Kindness</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal2">
                        <img src="images/story2.png" alt="The Giggle Garden" class="story-image">
                        <h3>The Giggle Garden!</h3>
                        <p>Based on Growing Together</p>
                        <div class="story-tags">
                            <span class="story-tag">Garden</span>
                            <span class="story-tag">Joy</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal3">
                        <img src="images/story3.png" alt="The Teeny-Tiny Treat Fairies" class="story-image">
                        <h3>The Teeny-Tiny Treat Fairies!</h3>
                        <p>Based on The Power of Small Gestures</p>
                        <div class="story-tags">
                            <span class="story-tag">Kindness</span>
                            <span class="story-tag">Magic</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="400">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal4">
                        <img src="images/story4.png" alt="The Wacky Puzzle Family" class="story-image">
                        <h3>The Wacky Puzzle Family!</h3>
                        <p>Based on Finding Strength in Family</p>
                        <div class="story-tags">
                            <span class="story-tag">Family</span>
                            <span class="story-tag">Uniqueness</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="500">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal5">
                        <img src="images/story5.png" alt="The Super-Sticky Hug Team" class="story-image">
                        <h3>The Super-Sticky Hug Team!</h3>
                        <p>Based on The Power of Family Support</p>
                        <div class="story-tags">
                            <span class="story-tag">Family</span>
                            <span class="story-tag">Support</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal4" data-category="growth">
                        <img src="images/story4.png" alt="Personal Growth" class="story-image">
                        <div class="story-tag">Personal Growth</div>
                        <h3>Finding Strength in Family</h3>
                        <p>How Reuel and Ezra's unique perspectives have enriched the family's understanding of connection and growth...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal5" data-category="community">
                        <img src="images/story5.png" alt="Community Support" class="story-image">
                        <div class="story-tag">Community</div>
                        <h3>The Power of Family Support</h3>
                        <p>When the Graves family faced challenges, their bond and mutual support created a foundation of strength...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal6" data-category="daily">
                        <img src="images/story6.png" alt="Daily Kindness" class="story-image">
                        <div class="story-tag">Daily Kindness</div>
                        <h3>The Kindness Calendar Crew!</h3>
                        <p>Every morning, the Sparkle Family would check their special Kindness Calendar! Each day had a new fun way to be kind. Monday might be "Share a Toy Day," Tuesday could be "Help a Friend Day," and Wednesday was always "Super-Duper Hug Day!" The calendar would giggle and sparkle when they completed their kind act, and sometimes it would even give them a tiny gold star that would float around their heads!</p>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal7" data-category="random">
                        <img src="images/story7.png" alt="Family Innovation" class="story-image">
                        <div class="story-tag">Random Acts</div>
                        <h3>The Magical Tech Team!</h3>
                        <p>Trinity loved playing with her tablet, but one day it started doing something super special! When she shared her screen with her little brother, the tablet would make funny faces and play silly songs. When she helped her sister with homework, it would show sparkly stars and encouraging messages. The tablet had become part of the Sparkle Family's kindness team!</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal8" data-category="growth">
                        <img src="images/story8.png" alt="Family Growth" class="story-image">
                        <div class="story-tag">Personal Growth</div>
                        <h3>The Dancing Garden!</h3>
                        <p>Sarah's garden was no ordinary garden - it was a Dancing Garden! When the family would sing songs or play music, the flowers would sway and dance. The sunflowers would do the twist, the roses would waltz, and the daisies would do cartwheels! The garden loved when the family would come to visit and share their music, and it would grow extra beautiful just to show its appreciation!</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal9" data-category="family">
                        <img src="images/story9.png" alt="Family Harmony" class="story-image">
                        <div class="story-tag">Family Moments</div>
                        <h3>The Smart Home Helpers!</h3>
                        <p>Trinity's smart home devices had a special mission: to help the family be kind! The lights would dim softly when someone was sleepy, the thermostat would make the house cozy when someone was sad, and the doorbell would play happy songs when friends came to visit. They all worked together like a big, happy family of helpful gadgets!</p>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal10" data-category="daily">
                        <img src="images/story10.png" alt="Family Traditions" class="story-image">
                        <div class="story-tag">Daily Kindness</div>
                        <h3>The Happy Kitchen Helpers!</h3>
                        <p>Elijah's kitchen was full of happy helpers! The spices would dance in their jars, the pots and pans would sing while they cooked, and the refrigerator would tell jokes to make everyone smile. When someone was hungry, all the kitchen helpers would work together to make the yummiest, happiest meals ever!</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal11" data-category="growth">
                        <img src="images/story11.png" alt="Family Creativity" class="story-image">
                        <div class="story-tag">Personal Growth</div>
                        <h3>The Musical Magic Makers!</h3>
                        <p>Mariah's instruments had a special power - they could make anyone feel better! When someone was sad, the piano would play happy tunes, the guitar would strum cheerful songs, and the drums would beat out bouncy rhythms. The instruments loved to play together and spread joy throughout the house!</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal12" data-category="community">
                        <img src="images/story12.png" alt="Family Organization" class="story-image">
                        <div class="story-tag">Community</div>
                        <h3>The Book Buddy Brigade!</h3>
                        <p>Veronica's books were the best friends anyone could have! They would jump off the shelves to share their stories, the picture books would make their characters dance, and the storybooks would create magical worlds right in the living room. The books loved to help children learn and imagine!</p>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal13" data-category="random">
                        <img src="images/story13.png" alt="Family Entertainment" class="story-image">
                        <div class="story-tag">Random Acts</div>
                        <h3>The TV Time Team!</h3>
                        <p>Reuel's TV remote had a special job - it helped the family choose shows that would make everyone happy! It would glow when it found a show about kindness, play a happy tune for family shows, and even suggest shows that would help everyone learn something new. The remote loved bringing the family together for fun TV time!</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal14" data-category="growth">
                        <img src="images/story14.png" alt="Family Wellness" class="story-image">
                        <div class="story-tag">Personal Growth</div>
                        <h3>The Exercise Energy Elves!</h3>
                        <p>Ezra's exercise equipment was full of tiny energy elves! They would help make exercise fun by turning jumping jacks into a dance party, making push-ups into a game, and turning running into an adventure. The elves loved helping everyone stay healthy and happy!</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal15" data-category="family">
                        <img src="images/story15.png" alt="Family Innovation" class="story-image">
                        <div class="story-tag">Family Moments</div>
                        <h3>The Photo Frame Friends!</h3>
                        <p>The family's photo frames were like a big family of friends! They would share their favorite memories with each other, the pictures would come to life and wave hello, and the frames would arrange themselves to tell the best family stories. They loved helping the family remember all their happy times!</p>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal16" data-category="daily">
                        <img src="images/story16.png" alt="Family Growth" class="story-image">
                        <div class="story-tag">Daily Kindness</div>
                        <h3>The Pet Tech Team!</h3>
                        <p>The family's pets had their own special technology! The cat could order her favorite treats with a paw print scanner, the dog could video call his friends with a special collar, and the fish could change the color of their tank with a fin flick. The pets loved using their tech to stay connected with their family!</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal17" data-category="family">
                        <img src="images/story17.png" alt="Family Harmony" class="story-image">
                        <div class="story-tag">Family Moments</div>
                        <h3>The Game Night Gang!</h3>
                        <p>The family's board games were the most fun gang ever! The pieces would dance around the board, the cards would tell jokes, and the dice would do somersaults. They loved bringing the family together for game night and making everyone laugh!</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal18" data-category="random">
                        <img src="images/story18.png" alt="Family Innovation" class="story-image">
                        <div class="story-tag">Random Acts</div>
                        <h3>The Laundry Day Llamas!</h3>
                        <p>The washing machine had a special team of laundry llamas! They would fold clothes into origami shapes, make socks dance, and turn laundry day into a fashion show. The llamas loved making laundry fun and helping keep everyone's clothes clean and happy!</p>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal19" data-category="community">
                        <img src="images/story19.png" alt="Family Growth" class="story-image">
                        <div class="story-tag">Community</div>
                        <h3>The Garden Band!</h3>
                        <p>Sarah's garden had its own band! The flowers would play their petals like violins, the leaves would rustle like maracas, and the wind chimes would join in with their tinkling tunes. The garden band loved playing music to help the plants grow and make everyone smile!</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal20" data-category="daily">
                        <img src="images/story20.png" alt="Family Harmony" class="story-image">
                        <div class="story-tag">Daily Kindness</div>
                        <h3>The Recipe Rainbow Team!</h3>
                        <p>The family's cookbooks were full of magical recipes! The ingredients would dance into the bowl, the measuring cups would sing while they worked, and the food would sparkle as it cooked. The recipes loved helping the family create delicious meals together!</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Story Modals -->
    <div class="modal fade story-modal" id="storyModal1" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Super Sparkle Family!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story1.png" alt="The Super Sparkle Family" class="modal-image">
                    <p>Once upon a time, lived Mommy and Daddy Graves who had a super-duper secret power: the power of Sparkle Kindness! It wasn't glitter, oh no! It was a special way of being super nice that made everyone around them giggle and feel warm like a hug. They taught their eight little Sparkle Spouts – Trinity, Elijah, Mariah, Veronica, Reuel, and Ezra – how to use their Sparkle Kindness too! Trinity loved to share her toys, Elijah always helped tidy up with a song, and all the little Spouts found their own way to sparkle!</p>
                    <p>And guess what? When the Sparkle Spouts grew up and had their own little Sparkle Sprinkles (that's kids!), they taught them the secret too! So the world got more and more sparkly and happy!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Imagine kindness as actual sparkles you could see!</p>
                        <h4>Life Lesson:</h4>
                        <p>Being kind is a superpower you can share, and it makes everyone happy!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal2" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Giggle Garden!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story2.png" alt="The Giggle Garden" class="modal-image">
                    <p>Trinity and Elijah, who used to be little Sparkle Spouts, were all grown up! They remembered how much fun it was to share Sparkle Kindness, so they decided to plant a Giggle Garden with their own children. Every time someone shared a toy, helped a friend, or gave a super-duper hug, a silly giggling flower would pop up in the garden! Some flowers giggled like "Hee-hee-hee!" and some went "Ho-ho-ho!" Soon, their whole neighborhood was filled with the sound of giggling flowers!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Flowers that giggle when you're kind!</p>
                        <h4>Life Lesson:</h4>
                        <p>When you're kind to others, you help happy things (and giggles) grow all around you!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal3" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Teeny-Tiny Treat Fairies!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story3.png" alt="The Teeny-Tiny Treat Fairies" class="modal-image">
                    <p>Mariah and Veronica loved doing teeny-tiny kind things, like leaving a shiny pebble for a friend or drawing a smiley face on a dusty car. They pretended they were Teeny-Tiny Treat Fairies! They didn't know it, but every time they did a small kind thing, a little bit of invisible happy dust would sprinkle down. Soon, their town was covered in so much happy dust that grumpy cats started purring, sad clouds started raining lemonade, and everyone had a spring in their step!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Invisible happy dust that makes grumpy cats purr and clouds rain lemonade!</p>
                        <h4>Life Lesson:</h4>
                        <p>Even the smallest nice things you do can make a big, happy difference!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal4" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Wacky Puzzle Family!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story4.png" alt="The Wacky Puzzle Family" class="modal-image">
                    <p>Reuel and Ezra were part of the Sparkle Family, but they were like a super special puzzle piece! Reuel loved to look at things upside down, which sometimes helped him see solutions nobody else could! Ezra loved to whisper secrets to the squirrels, and sometimes the squirrels whispered back important news! The family learned that everyone being a little bit different and wacky made their family puzzle complete and super strong, like a fortress made of bouncy castles!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Solving problems by looking upside down and squirrels whispering secrets.</p>
                        <h4>Life Lesson:</h4>
                        <p>Everyone is different and special, and that's what makes a family strong and fun!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal5" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Super-Sticky Hug Team!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story5.png" alt="The Super-Sticky Hug Team" class="modal-image">
                    <p>Sometimes, even the Sparkle Family had ouchie days or tricky times. Maybe someone's balloon popped, or a drawing got smudged. When that happened, they turned into the Super-Sticky Hug Team! Mommy and Daddy Graves showed them how. If one person felt wobbly, everyone else would give them a super-sticky hug until the wobbles went away and turned into giggles. They stuck together like peanut butter and jelly!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Hugs so sticky they make wobbles go away!</p>
                        <h4>Life Lesson:</h4>
                        <p>Families help each other and stick together, especially when things are tough. That makes everyone feel better!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal6" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Kindness Calendar Crew!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story6.png" alt="The Kindness Calendar Crew" class="modal-image">
                    <p>Every morning, the Sparkle Family would check their special Kindness Calendar! Each day had a new fun way to be kind. Monday might be "Share a Toy Day," Tuesday could be "Help a Friend Day," and Wednesday was always "Super-Duper Hug Day!" The calendar would giggle and sparkle when they completed their kind act, and sometimes it would even give them a tiny gold star that would float around their heads!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>A calendar that giggles and gives floating gold stars!</p>
                        <h4>Life Lesson:</h4>
                        <p>Making kindness a daily habit makes every day special and fun!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal7" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Magical Tech Team!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story7.png" alt="The Magical Tech Team" class="modal-image">
                    <p>Trinity loved playing with her tablet, but one day it started doing something super special! When she shared her screen with her little brother, the tablet would make funny faces and play silly songs. When she helped her sister with homework, it would show sparkly stars and encouraging messages. The tablet had become part of the Sparkle Family's kindness team!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>A tablet that makes funny faces and plays silly songs when you share!</p>
                        <h4>Life Lesson:</h4>
                        <p>Technology can be a fun way to share kindness with others!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal8" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Dancing Garden!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story8.png" alt="The Dancing Garden" class="modal-image">
                    <p>Sarah's garden was no ordinary garden - it was a Dancing Garden! When the family would sing songs or play music, the flowers would sway and dance. The sunflowers would do the twist, the roses would waltz, and the daisies would do cartwheels! The garden loved when the family would come to visit and share their music, and it would grow extra beautiful just to show its appreciation!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Flowers that dance to music and do cartwheels!</p>
                        <h4>Life Lesson:</h4>
                        <p>Sharing your talents and joy with others makes everything more beautiful!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal9" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Smart Home Helpers!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story9.png" alt="The Smart Home Helpers" class="modal-image">
                    <p>Trinity's smart home devices had a special mission: to help the family be kind! The lights would dim softly when someone was sleepy, the thermostat would make the house cozy when someone was sad, and the doorbell would play happy songs when friends came to visit. They all worked together like a big, happy family of helpful gadgets!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>A doorbell that plays happy songs for visitors!</p>
                        <h4>Life Lesson:</h4>
                        <p>Even the smallest things can help make someone's day better!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal10" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Happy Kitchen Helpers!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story10.png" alt="The Happy Kitchen Helpers" class="modal-image">
                    <p>Elijah's kitchen was full of happy helpers! The spices would dance in their jars, the pots and pans would sing while they cooked, and the refrigerator would tell jokes to make everyone smile. When someone was hungry, all the kitchen helpers would work together to make the yummiest, happiest meals ever!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Dancing spices and joke-telling refrigerators!</p>
                        <h4>Life Lesson:</h4>
                        <p>Working together and having fun makes even chores enjoyable!</p>
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
                    <img src="images/story11.png" alt="The Musical Magic Makers" class="modal-image">
                    <p>Mariah's instruments had a special power - they could make anyone feel better! When someone was sad, the piano would play happy tunes, the guitar would strum cheerful songs, and the drums would beat out bouncy rhythms. The instruments loved to play together and spread joy throughout the house!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Instruments that play themselves to cheer people up!</p>
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
                    <p>Veronica's books were the best friends anyone could have! They would jump off the shelves to share their stories, the picture books would make their characters dance, and the storybooks would create magical worlds right in the living room. The books loved to help children learn and imagine!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Books that jump off shelves and make characters dance!</p>
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
                    <p>Reuel's TV remote had a special job - it helped the family choose shows that would make everyone happy! It would glow when it found a show about kindness, play a happy tune for family shows, and even suggest shows that would help everyone learn something new. The remote loved bringing the family together for fun TV time!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>A remote that glows and plays tunes to find the perfect show!</p>
                        <h4>Life Lesson:</h4>
                        <p>Sharing entertainment with family can create special memories!</p>
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
                    <p>Ezra's exercise equipment was full of tiny energy elves! They would help make exercise fun by turning jumping jacks into a dance party, making push-ups into a game, and turning running into an adventure. The elves loved helping everyone stay healthy and happy!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Tiny elves that turn exercise into fun games!</p>
                        <h4>Life Lesson:</h4>
                        <p>Staying active can be fun when you make it a game!</p>
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
                    <p>The family's photo frames were like a big family of friends! They would share their favorite memories with each other, the pictures would come to life and wave hello, and the frames would arrange themselves to tell the best family stories. They loved helping the family remember all their happy times!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Photos that come to life and wave hello!</p>
                        <h4>Life Lesson:</h4>
                        <p>Family memories are precious treasures to cherish!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal16" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Pet Tech Team!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story16.png" alt="The Pet Tech Team" class="modal-image">
                    <p>The family's pets had their own special technology! The cat could order her favorite treats with a paw print scanner, the dog could video call his friends with a special collar, and the fish could change the color of their tank with a fin flick. The pets loved using their tech to stay connected with their family!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Pets using technology with paw prints and fin flicks!</p>
                        <h4>Life Lesson:</h4>
                        <p>Pets are part of the family and deserve to be happy too!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal17" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Game Night Gang!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story17.png" alt="The Game Night Gang" class="modal-image">
                    <p>The family's board games were the most fun gang ever! The pieces would dance around the board, the cards would tell jokes, and the dice would do somersaults. They loved bringing the family together for game night and making everyone laugh!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Dancing game pieces and somersaulting dice!</p>
                        <h4>Life Lesson:</h4>
                        <p>Playing games together creates special family memories!</p>
                    </div>
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
                    <p>The washing machine had a special team of laundry llamas! They would fold clothes into origami shapes, make socks dance, and turn laundry day into a fashion show. The llamas loved making laundry fun and helping keep everyone's clothes clean and happy!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Laundry llamas that fold clothes into origami!</p>
                        <h4>Life Lesson:</h4>
                        <p>Even chores can be fun when you use your imagination!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal19" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Garden Band!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story19.png" alt="The Garden Band" class="modal-image">
                    <p>Sarah's garden had its own band! The flowers would play their petals like violins, the leaves would rustle like maracas, and the wind chimes would join in with their tinkling tunes. The garden band loved playing music to help the plants grow and make everyone smile!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Flowers playing petal violins and leaves as maracas!</p>
                        <h4>Life Lesson:</h4>
                        <p>Nature has its own beautiful music if you listen carefully!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal20" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Recipe Rainbow Team!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story20.png" alt="The Recipe Rainbow Team" class="modal-image">
                    <p>The family's cookbooks were full of magical recipes! The ingredients would dance into the bowl, the measuring cups would sing while they worked, and the food would sparkle as it cooked. The recipes loved helping the family create delicious meals together!</p>
                    <div class="story-lessons">
                        <h4>Silly Bit:</h4>
                        <p>Dancing ingredients and singing measuring cups!</p>
                        <h4>Life Lesson:</h4>
                        <p>Cooking together as a family creates special memories and yummy food!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

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