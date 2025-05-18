<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stories - catn8.us</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.css">
    <link href="https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-color: #FF6B6B;
            --secondary-color: #4ECDC4;
            --accent-color: #FFE66D;
            --dark-color: #2C3E50;
            --light-color: #F7F9FC;
            --fun-purple: #9B59B6;
            --fun-green: #2ECC71;
            --fun-orange: #E67E22;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Comic Neue', cursive;
            line-height: 1.6;
            color: var(--dark-color);
            background: url('images/pattern.svg') repeat;
            overflow-x: hidden;
            position: relative;
        }

        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: url('images/homepage_friends.jpg') center/cover no-repeat fixed;
            opacity: 0.1;
            z-index: -1;
        }

        /* PBS Kids-inspired Navigation */
        .navbar {
            background: linear-gradient(135deg, var(--fun-purple), var(--fun-green));
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            padding: 1rem 0;
        }

        .navbar-brand img {
            height: 60px;
            transition: transform 0.3s ease;
        }

        .navbar-brand img:hover {
            transform: scale(1.1);
        }

        .nav-link {
            font-size: 1.2rem;
            color: white !important;
            padding: 0.5rem 1rem;
            margin: 0 0.5rem;
            border-radius: 25px;
            transition: all 0.3s ease;
            background: rgba(255, 255, 255, 0.1);
        }

        .nav-link:hover {
            background: rgba(255, 255, 255, 0.2);
            color: white !important;
            transform: translateY(-2px);
        }

        /* Section Styles */
        .section {
            padding: 4rem 0;
            position: relative;
        }

        .section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: inherit;
            filter: blur(10px);
            z-index: -1;
        }

        .section:nth-child(odd) {
            background: linear-gradient(135deg, var(--fun-purple), var(--fun-green));
            color: white;
        }

        .section:nth-child(even) {
            background: linear-gradient(135deg, var(--fun-orange), var(--fun-purple));
            color: white;
        }

        .section.bg-light {
            background: linear-gradient(135deg, var(--fun-green), var(--secondary-color)) !important;
            color: white;
        }

        .section-title {
            font-size: 2.5rem;
            color: white;
            margin-bottom: 2rem;
            text-align: center;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        /* Story Cards */
        .story-card {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            border: 2px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            margin-bottom: 2rem;
            padding: 1.5rem;
            position: relative;
            cursor: pointer;
        }

        .age-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 15px;
            font-size: 0.9rem;
            backdrop-filter: blur(5px);
            z-index: 1;
        }

        .story-card:hover {
            transform: translateY(-5px);
            background: rgba(255, 255, 255, 0.25);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }

        .story-section {
            margin-bottom: 1.5rem;
        }

        .story-title {
            color: white;
            font-size: 1.5rem;
            margin: 1rem 0;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .story-text {
            color: white;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
            font-size: 1.1rem;
            line-height: 1.6;
            margin-bottom: 1rem;
        }

        .story-image {
            width: 100%;
            height: 250px;
            object-fit: cover;
            border-radius: 15px;
            margin-bottom: 1rem;
            border: 2px solid rgba(255, 255, 255, 0.3);
            transition: transform 0.3s ease;
        }

        .story-card:hover .story-image {
            transform: scale(1.05);
        }

        .story-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 1rem;
        }

        .story-tag {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 15px;
            font-size: 0.9rem;
            backdrop-filter: blur(5px);
        }

        .lead {
            color: white;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        /* Story Navigation */
        .story-navigation {
            position: fixed;
            right: 20px;
            top: 100px;
            z-index: 1000;
            background: rgba(255, 255, 255, 0.15);
            padding: 20px;
            border-radius: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            border: 2px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
        }

        .story-navigation .nav-item {
            margin: 10px 0;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1.1rem;
            padding: 10px;
            border-radius: 15px;
            text-align: center;
            color: white;
            background: rgba(255, 255, 255, 0.1);
        }

        .story-navigation .nav-item:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }

        .story-navigation .nav-item.active {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }

        /* Modal Styles */
        .story-modal .modal-content {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            border: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            backdrop-filter: blur(10px);
        }

        .story-modal .modal-header {
            border-bottom: none;
            padding: 2rem 2rem 1rem;
            background: linear-gradient(135deg, var(--fun-purple), var(--fun-green));
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
            border: 2px solid rgba(255, 255, 255, 0.3);
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .section-title {
                font-size: 2rem;
            }
            
            .story-navigation {
                position: static;
                margin-bottom: 2rem;
            }
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-light sticky-top">
        <div class="container">
            <a class="navbar-brand" href="/">
                <img src="images/catn8_logo.jpeg" alt="catn8.us Logo">
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
                        <a class="nav-link" href="activities.php">Activities</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="section">
        <div class="container">
            <h1 class="section-title">Magical Stories for Everyone!</h1>
            <p class="lead text-center mb-5">Discover enchanting tales that spark imagination and joy!</p>
            
            <div class="row">
                <!-- Story Cards -->
                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal1">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story1_beginning.jpg" alt="Papa and Nana creating magical sparkles" class="story-image">
                            <h3 class="story-title">The Super Sparkle Family!</h3>
                            <p class="story-text">Papa and Nana had a special power - their hugs were so full of love that they created magical sparkles! When they hugged someone, tiny stars of joy would float around them, making everyone feel warm and happy inside.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Adventure</span>
                            <span class="story-tag">Friendship</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal2">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story2_beginning.jpg" alt="Kitchen appliances coming to life" class="story-image">
                            <h3 class="story-title">Elijah's Kitchen of Culinary Craziness</h3>
                            <p class="story-text">When Elijah's kitchen appliances came to life with their own personalities, they turned cooking into a wild adventure. His blender started doing happy dances, his toaster told jokes, and his mixer sang songs while it worked.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Family</span>
                            <span class="story-tag">Creativity</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal3">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story3_beginning.jpg" alt="Magical calendar with eyeballs" class="story-image">
                            <h3 class="story-title">The Magical Calendar of Kindness</h3>
                            <p class="story-text">In a cozy corner of the house, there lived a magical calendar with blinking eyes. It wasn't just any calendar - it had the power to make every day special with acts of kindness!</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Kindness</span>
                            <span class="story-tag">Magic</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal4">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story4_beginning.jpg" alt="Puzzle pieces coming to life" class="story-image">
                            <h3 class="story-title">The Family Puzzle Adventure</h3>
                            <p class="story-text">In a magical puzzle box, each piece came alive with its own personality. Some pieces were round and bouncy, others were square and steady, but they all had one thing in common - they were part of the same family!</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Family</span>
                            <span class="story-tag">Creativity</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal5">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story5_beginning.jpg" alt="Magical garden coming to life" class="story-image">
                            <h3 class="story-title">The Singing Garden</h3>
                            <p class="story-text">In a special garden, flowers sang sweet melodies and trees danced in the breeze. It was a place where nature came alive with music and joy!</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Nature</span>
                            <span class="story-tag">Friendship</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal6">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story6_beginning.jpg" alt="Talking animals in forest" class="story-image">
                            <h3 class="story-title">The Wise Forest Friends</h3>
                            <p class="story-text">Deep in the forest, animals had the special ability to speak and share their wisdom with children. Each animal had its own unique lesson to teach!</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Animals</span>
                            <span class="story-tag">Learning</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal7">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story7_beginning.jpg" alt="Magical library entrance" class="story-image">
                            <h3 class="story-title">The Living Library</h3>
                            <p class="story-text">In a magical library, books didn't just sit on shelves - they came alive! Characters would jump from the pages and share their stories with eager young readers.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Reading</span>
                            <span class="story-tag">Imagination</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal8">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story8_beginning.jpg" alt="Musical instruments coming to life" class="story-image">
                            <h3 class="story-title">The Musical Instrument Friends</h3>
                            <p class="story-text">In a special music room, instruments came to life and taught children about the joy of music. Each instrument had its own personality and story to share!</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Music</span>
                            <span class="story-tag">Learning</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal9">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story9_beginning.jpg" alt="Colorful paint splashes" class="story-image">
                            <h3 class="story-title">The Magical Paint Box</h3>
                            <p class="story-text">In an art studio, paints had minds of their own! They would mix and swirl, creating beautiful pictures that told stories of their own.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Art</span>
                            <span class="story-tag">Creativity</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal10">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story10_beginning.jpg" alt="Numbers dancing" class="story-image">
                            <h3 class="story-title">The Dancing Numbers</h3>
                            <p class="story-text">In a magical math classroom, numbers came alive and danced! Each number had its own special moves and personality.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Math</span>
                            <span class="story-tag">Learning</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal11">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story11_beginning.jpg" alt="Letters floating" class="story-image">
                            <h3 class="story-title">The Dancing Letters</h3>
                            <p class="story-text">In a magical classroom, letters came alive and danced! Each letter had its own special moves and personality.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Reading</span>
                            <span class="story-tag">Learning</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal12">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story12_beginning.jpg" alt="Shapes dancing" class="story-image">
                            <h3 class="story-title">The Shape Shapers</h3>
                            <p class="story-text">In a magical art room, shapes came alive and transformed! Circles became wheels, squares became houses, and triangles became mountains.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Shapes</span>
                            <span class="story-tag">Learning</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal13">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story13.png" alt="Colors mixing" class="story-image">
                            <h3 class="story-title">The Color Mixers</h3>
                            <p class="story-text">In a magical art studio, colors came alive and mixed! Red and blue would dance together to make purple, yellow and blue would twirl to make green.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Colors</span>
                            <span class="story-tag">Art</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal14">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story14.png" alt="Animals in classroom" class="story-image">
                            <h3 class="story-title">The Animal Teachers</h3>
                            <p class="story-text">In a magical classroom, animals came to teach children about nature! Each animal had its own special lesson to share.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Animals</span>
                            <span class="story-tag">Nature</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal15">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story15.png" alt="Musical notes floating" class="story-image">
                            <h3 class="story-title">The Dancing Notes</h3>
                            <p class="story-text">In a magical music room, musical notes came alive and danced! Each note had its own special sound and personality.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Music</span>
                            <span class="story-tag">Learning</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal16">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story16.png" alt="Words floating" class="story-image">
                            <h3 class="story-title">The Word Wizards</h3>
                            <p class="story-text">In a magical writing room, words came alive and told stories! Each word had its own special meaning and personality.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Writing</span>
                            <span class="story-tag">Creativity</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal17">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story17.png" alt="Numbers dancing" class="story-image">
                            <h3 class="story-title">The Number Ninjas</h3>
                            <p class="story-text">In a magical math room, numbers came alive and played games! Each number had its own special value and personality.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Math</span>
                            <span class="story-tag">Learning</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal18">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story18.png" alt="Colors mixing" class="story-image">
                            <h3 class="story-title">The Color Creators</h3>
                            <p class="story-text">In a magical art room, colors came alive and painted pictures! Each color had its own special shade and personality.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Art</span>
                            <span class="story-tag">Creativity</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal19">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story19.png" alt="Animals in classroom" class="story-image">
                            <h3 class="story-title">The Nature Navigators</h3>
                            <p class="story-text">In a magical nature room, animals came alive and shared their wisdom! Each animal had its own special knowledge and personality.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Animals</span>
                            <span class="story-tag">Nature</span>
                        </div>
                    </div>
                </div>

                <div class="col-md-6 mb-4">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal20">
                        <div class="age-badge">3-7</div>
                        <div class="story-section">
                            <img src="images/story20.png" alt="Musical notes floating" class="story-image">
                            <h3 class="story-title">The Melody Makers</h3>
                            <p class="story-text">In a magical music room, melodies came alive and created harmony! Each melody had its own special tune and personality.</p>
                        </div>
                        <div class="story-tags">
                            <span class="story-tag">Music</span>
                            <span class="story-tag">Learning</span>
                        </div>
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
                    <div class="story-content">
                        <img src="images/story1_beginning.jpg" alt="Papa and Nana creating magical sparkles" class="modal-image">
                        <p>Papa and Nana had a special power - their hugs were so full of love that they created magical sparkles! When they hugged someone, tiny stars of joy would float around them, making everyone feel warm and happy inside.</p>
                        
                        <img src="images/story1_middle.jpg" alt="Family sharing sparkles" class="modal-image">
                        <p>Their sparkles helped Trinity find strength when she needed it most, gave Elijah confidence in the kitchen, and helped Reuel solve his trickiest puzzles. The magic spread to everyone in the family!</p>
                        
                        <img src="images/story1_end.jpg" alt="House filled with joy and laughter" class="modal-image">
                        <p>The Super Sparkle Family taught everyone that the best kind of magic is the love we share with our family. And that's why their sparkles will always be remembered as the most magical sparkles in the world!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal2" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Elijah's Kitchen of Culinary Craziness</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story2_beginning.jpg" alt="Kitchen appliances coming to life" class="modal-image">
                        <p>When Elijah's kitchen appliances came to life with their own personalities, they turned cooking into a wild adventure. His blender started doing happy dances, his toaster told jokes, and his mixer sang songs while it worked.</p>
                        
                        <img src="images/story2_middle.jpg" alt="Dancing kitchen appliances" class="modal-image">
                        <p>With his new kitchen friends, cooking became an adventure. They helped him create special meals for the whole family - from Papa and Nana's favorite recipes to treats for his nieces and nephews.</p>
                        
                        <img src="images/story2_end.jpg" alt="Family meal with kitchen friends" class="modal-image">
                        <p>Elijah learned that cooking wasn't just about making food - it was about creating joy and bringing the family together. And with his kitchen friends by his side, every meal became a celebration!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal3" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Magical Calendar of Kindness</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story3_beginning.jpg" alt="Magical calendar with eyeballs" class="modal-image">
                        <p>In a cozy corner of the house, there lived a magical calendar with blinking eyes. It wasn't just any calendar - it had the power to make every day special with acts of kindness!</p>
                        
                        <img src="images/story3_middle.jpg" alt="Calendar doing the chicken dance" class="modal-image">
                        <p>The calendar would dance and sing, suggesting fun ways to be kind. It taught the family that even small acts of kindness could make big differences in someone's day.</p>
                        
                        <img src="images/story3_end.jpg" alt="Family group hug with sparkles" class="modal-image">
                        <p>From sharing toys to helping with chores, the calendar showed that kindness was the best way to make every day magical. And that's how the family learned that kindness is the greatest superpower of all!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal4" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Family Puzzle Adventure</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story4_beginning.jpg" alt="Puzzle pieces coming to life" class="modal-image">
                        <p>In a magical puzzle box, each piece came alive with its own personality. Some pieces were round and bouncy, others were square and steady, but they all had one thing in common - they were part of the same family!</p>
                        
                        <img src="images/story4_middle.jpg" alt="Family puzzle pieces dancing" class="modal-image">
                        <p>Each piece represented a family member with their special traits. Papa's piece was strong and protective, Nana's piece was warm and caring, and each child's piece showed their unique talents and interests.</p>
                        
                        <img src="images/story4_end.jpg" alt="Complete family puzzle" class="modal-image">
                        <p>When all the pieces came together, they created a beautiful picture of family love. The puzzle taught everyone that even though they were different, they fit together perfectly as a family!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal5" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Singing Garden</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story5_beginning.jpg" alt="Magical garden coming to life" class="modal-image">
                        <p>In a special garden, flowers sang sweet melodies and trees danced in the breeze. It was a place where nature came alive with music and joy!</p>
                        
                        <img src="images/story5_middle.jpg" alt="Children playing in garden" class="modal-image">
                        <p>Children discovered that each plant had its own song to share. The roses sang lullabies, the sunflowers hummed happy tunes, and the trees provided the rhythm with their swaying branches.</p>
                        
                        <img src="images/story5_end.jpg" alt="Garden party celebration" class="modal-image">
                        <p>The garden taught everyone that nature is full of music and magic, and that every living thing has its own special song to share with the world!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal6" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Wise Forest Friends</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story6_beginning.jpg" alt="Talking animals in forest" class="modal-image">
                        <p>Deep in the forest, animals had the special ability to speak and share their wisdom with children. Each animal had its own unique lesson to teach!</p>
                        
                        <img src="images/story6_middle.jpg" alt="Children learning from animals" class="modal-image">
                        <p>The wise owl taught about patience, the playful squirrels showed the importance of sharing, and the gentle deer demonstrated kindness in action.</p>
                        
                        <img src="images/story6_end.jpg" alt="Forest harmony celebration" class="modal-image">
                        <p>Through their forest friends, children learned that wisdom comes in many forms, and that nature has much to teach us about living in harmony with others!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal7" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Living Library</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story7_beginning.jpg" alt="Magical library entrance" class="modal-image">
                        <p>In a magical library, books didn't just sit on shelves - they came alive! Characters would jump from the pages and share their stories with eager young readers.</p>
                        
                        <img src="images/story7_middle.jpg" alt="Books floating and dancing" class="modal-image">
                        <p>Children could interact with their favorite characters, ask questions, and even help solve problems in the stories. Each book became an interactive adventure!</p>
                        
                        <img src="images/story7_end.jpg" alt="Children reading with book characters" class="modal-image">
                        <p>The library taught everyone that reading isn't just about words on a page - it's about bringing stories to life and making new friends along the way!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal8" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Musical Instrument Friends</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story8_beginning.jpg" alt="Musical instruments coming to life" class="modal-image">
                        <p>In a special music room, instruments came to life and taught children about the joy of music. Each instrument had its own personality and story to share!</p>
                        
                        <img src="images/story8_middle.jpg" alt="Children dancing with instruments" class="modal-image">
                        <p>The piano played gentle lullabies, the drums kept the beat, and the violin sang sweet melodies. Together, they created beautiful harmonies!</p>
                        
                        <img src="images/story8_end.jpg" alt="Musical celebration" class="modal-image">
                        <p>Children learned that music is a universal language that brings people together and makes every day more magical!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal9" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Magical Paint Box</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story9_beginning.jpg" alt="Colorful paint splashes" class="modal-image">
                        <p>In an art studio, paints had minds of their own! They would mix and swirl, creating beautiful pictures that told stories of their own.</p>
                        
                        <img src="images/story9_middle.jpg" alt="Children painting with magical colors" class="modal-image">
                        <p>Children learned that each color had its own personality - red was bold and brave, blue was calm and peaceful, and yellow was bright and cheerful!</p>
                        
                        <img src="images/story9_end.jpg" alt="Art gallery of children's work" class="modal-image">
                        <p>Together, the colors and children created masterpieces that showed how art can express feelings and tell stories without words!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal10" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Dancing Numbers</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story10_beginning.jpg" alt="Numbers dancing" class="modal-image">
                        <p>In a magical math classroom, numbers came alive and danced! Each number had its own special moves and personality.</p>
                        
                        <img src="images/story10_middle.jpg" alt="Children solving math puzzles" class="modal-image">
                        <p>Children learned that math could be fun as they watched numbers form patterns, solve puzzles, and create beautiful mathematical dances!</p>
                        
                        <img src="images/story10_end.jpg" alt="Math celebration" class="modal-image">
                        <p>The numbers showed everyone that math isn't just about counting - it's about patterns, shapes, and the magic of numbers working together!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal11" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Dancing Letters</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story11_beginning.jpg" alt="Letters floating" class="modal-image">
                        <p>In a magical classroom, letters came alive and danced! Each letter had its own special moves and personality.</p>
                        
                        <img src="images/story11_middle.jpg" alt="Children reading with floating letters" class="modal-image">
                        <p>Children learned to read as they watched letters form words and sentences. The letters would jump and twirl, making reading fun!</p>
                        
                        <img src="images/story11_end.jpg" alt="Reading celebration" class="modal-image">
                        <p>Reading became a joyful adventure as children discovered the magic of words and stories!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal12" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Shape Shapers</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story12_beginning.jpg" alt="Shapes dancing" class="modal-image">
                        <p>In a magical art room, shapes came alive and transformed! Circles became wheels, squares became houses, and triangles became mountains.</p>
                        
                        <img src="images/story12_middle.jpg" alt="Children playing with shapes" class="modal-image">
                        <p>Children learned about geometry as they watched shapes combine and create amazing designs. Each shape had its own special power!</p>
                        
                        <img src="images/story12_end.jpg" alt="Shape celebration" class="modal-image">
                        <p>Shapes became the building blocks of imagination, showing children how to create anything they could dream of!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal13" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Color Mixers</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story13.png" alt="Colors mixing" class="modal-image">
                        <p>In a magical art studio, colors came alive and mixed! Red and blue would dance together to make purple, yellow and blue would twirl to make green.</p>
                        
                        <img src="images/story13_middle.jpg" alt="Children painting with colors" class="story-image">
                        <p>Children learned about color mixing as they watched colors combine and create beautiful new shades. Each color had its own personality!</p>
                        
                        <img src="images/story13_end.jpg" alt="Color celebration" class="modal-image">
                        <p>Art became a colorful adventure as children discovered the magic of creating their own unique colors!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal14" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Animal Teachers</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story14.png" alt="Animals in classroom" class="modal-image">
                        <p>In a magical classroom, animals came to teach children about nature! Each animal had its own special lesson to share.</p>
                        
                        <img src="images/story14_middle.jpg" alt="Children learning from animals" class="modal-image">
                        <p>Children learned about different species and their habitats. The wise owl taught about the night, the playful dolphin about the ocean.</p>
                        
                        <img src="images/story14_end.jpg" alt="Nature celebration" class="modal-image">
                        <p>Nature became a classroom of wonder as children discovered the amazing diversity of life on Earth!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal15" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Dancing Notes</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story15.png" alt="Musical notes floating" class="modal-image">
                        <p>In a magical music room, musical notes came alive and danced! Each note had its own special sound and personality.</p>
                        
                        <img src="images/story15_middle.jpg" alt="Children playing music" class="modal-image">
                        <p>Children learned to play music as they watched notes dance and create beautiful melodies. The notes would jump and twirl, making music fun!</p>
                        
                        <img src="images/story15_end.jpg" alt="Music celebration" class="modal-image">
                        <p>Music became a celebration of joy as children discovered the magic of creating their own songs!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal16" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Word Wizards</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story16.png" alt="Words floating" class="modal-image">
                        <p>In a magical writing room, words came alive and told stories! Each word had its own special meaning and personality.</p>
                        
                        <img src="images/story16_middle.jpg" alt="Children writing stories" class="modal-image">
                        <p>Children learned to write as they watched words combine and create amazing tales. The words would dance and play, making writing fun!</p>
                        
                        <img src="images/story16_end.jpg" alt="Writing celebration" class="modal-image">
                        <p>Writing became a creative adventure as children discovered the magic of telling their own stories!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal17" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Number Ninjas</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story17.png" alt="Numbers dancing" class="modal-image">
                        <p>In a magical math room, numbers came alive and played games! Each number had its own special value and personality.</p>
                        
                        <img src="images/story17_middle.jpg" alt="Children counting objects" class="modal-image">
                        <p>Children learned math as they watched numbers solve puzzles and play games. The numbers would jump and twirl, making math fun!</p>
                        
                        <img src="images/story17_end.jpg" alt="Math celebration" class="modal-image">
                        <p>Math became an exciting challenge as children discovered the magic of numbers!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal18" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Color Creators</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story18.png" alt="Colors mixing" class="modal-image">
                        <p>In a magical art room, colors came alive and painted pictures! Each color had its own special shade and personality.</p>
                        
                        <img src="images/story18_middle.jpg" alt="Children painting" class="modal-image">
                        <p>Children learned to paint as they watched colors mix and create beautiful art. The colors would dance and play, making art fun!</p>
                        
                        <img src="images/story18_end.jpg" alt="Art celebration" class="modal-image">
                        <p>Art became a colorful journey as children discovered the magic of creating their own masterpieces!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal19" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Nature Navigators</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story19.png" alt="Animals in classroom" class="modal-image">
                        <p>In a magical nature room, animals came alive and shared their wisdom! Each animal had its own special knowledge and personality.</p>
                        
                        <img src="images/story19_middle.jpg" alt="Children learning from animals" class="modal-image">
                        <p>Children learned about nature as they watched animals teach and play. The animals would dance and sing, making learning fun!</p>
                        
                        <img src="images/story19_end.jpg" alt="Nature celebration" class="modal-image">
                        <p>Nature became a magical teacher as children discovered the wonders of the world!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal20" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Melody Makers</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story20.png" alt="Musical notes floating" class="modal-image">
                        <p>In a magical music room, melodies came alive and created harmony! Each melody had its own special tune and personality.</p>
                        
                        <img src="images/story20_middle.jpg" alt="Children playing music" class="modal-image">
                        <p>Children learned to make music as they watched melodies dance and play. The melodies would jump and twirl, making music fun!</p>
                        
                        <img src="images/story20_end.jpg" alt="Music celebration" class="modal-image">
                        <p>Music became a celebration of joy as children discovered the magic of creating their own songs!</p>
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

        // Handle image loading errors
        document.querySelectorAll('.story-image, .modal-image').forEach(img => {
            img.onerror = function() {
                this.classList.add('error');
                this.alt = 'Image not available';
                this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23FF6B6B"/><text x="50" y="50" font-family="Arial" font-size="12" fill="white" text-anchor="middle" dy=".3em">Image not available</text></svg>';
            };
        });

        // Initialize all modals
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            new bootstrap.Modal(modal);
        });
    </script>
</body>
</html> 