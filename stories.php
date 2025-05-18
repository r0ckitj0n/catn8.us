<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stories - catn8.us</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.css">
    <link rel="stylesheet" href="css/stories.css">
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
            padding: 1rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: all 0.5s ease;
            cursor: pointer;
            border: 3px solid transparent;
            position: relative;
            overflow: hidden;
            height: 429px;
            display: flex;
            flex-direction: column;
        }

        .story-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .story-section {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }

        .story-image {
            width: 100%;
            height: 214px;
            object-fit: cover;
            border-radius: 15px;
            margin-bottom: 0.5rem;
            border: 3px solid var(--accent-color);
        }

        .story-text {
            font-size: 0.9rem;
            color: var(--dark-color);
            margin-bottom: 0.5rem;
            line-height: 1.4;
            flex-grow: 1;
        }

        .story-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: auto;
        }

        .story-tag {
            background: var(--accent-color);
            color: var(--primary-color);
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
            top: 100px;
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

        .age-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            background: var(--primary-color);
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: bold;
            z-index: 1;
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

        .platform {
            background: var(--accent-color);
            color: var(--primary-color);
            padding: 0.25rem 0.75rem;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: bold;
        }

        .modal-body .story-content {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .modal-body .modal-image {
            width: 100%;
            max-height: 400px;
            object-fit: cover;
            border-radius: 15px;
            border: 3px solid var(--accent-color);
        }

        .modal-body p {
            font-size: 1.2rem;
            line-height: 1.6;
            color: var(--dark-color);
            margin: 0;
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
                        <a class="nav-link" href="activities.php">Activities</a>
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

    <!-- Story Navigation -->
    <div class="story-navigation" data-aos="fade-left">
        <div class="d-flex flex-column gap-2">
            <div class="nav-item active" data-filter="all">All Stories</div>
            <div class="nav-item" data-filter="3-7">Ages 3-7</div>
            <div class="nav-item" data-filter="8-12">Ages 8-12</div>
            <div class="nav-item" data-filter="13">Ages 13+</div>
            <div class="nav-item" data-filter="family">Family</div>
            <div class="nav-item" data-filter="daily">Daily Kindness</div>
            <div class="nav-item" data-filter="growth">Growth</div>
            <div class="nav-item" data-filter="random">Random Acts</div>
        </div>
    </div>

    <section class="stories-section">
        <div class="container">
            <div class="row">
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal1" data-category="family" data-age="3-7">
                        <div class="story-content">
                            <h3>The Super Sparkle Family!</h3>
                            <div class="story-section">
                                <img src="images/story1_beginning.jpg" alt="Papa and Nana creating magical sparkles" class="story-image">
                                <p class="story-text">Papa and Nana's magical hugs create sparkles of joy that make everyone feel warm and happy!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Family</span>
                                <span class="story-tag">Kindness</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal2" data-category="daily" data-age="3-7">
                        <div class="story-content">
                            <h3>Elijah's Kitchen of Culinary Craziness</h3>
                            <div class="story-section">
                                <img src="images/story2_beginning.jpg" alt="Kitchen appliances coming to life" class="story-image">
                                <p class="story-text">Dancing blenders and singing mixers turn cooking into a wild adventure for the whole family!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Daily Kindness</span>
                                <span class="story-tag">Creativity</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal3" data-category="family" data-age="3-7">
                        <div class="story-content">
                            <h3>The Sparkle Family's Giggle-Wiggle Kindness Calendar</h3>
                            <div class="story-section">
                                <img src="images/story3_beginning.jpg" alt="Magical calendar with eyeballs" class="story-image">
                                <p class="story-text">A magical calendar with blinking eyes makes every day a new adventure in kindness!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Family</span>
                                <span class="story-tag">Magic</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal4" data-category="family" data-age="3-7">
                        <div class="story-content">
                            <h3>Reuel's Wacky Puzzle Family!</h3>
                            <div class="story-section">
                                <img src="images/story4_beginning.jpg" alt="Puzzle pieces coming to life" class="story-image">
                                <p class="story-text">Puzzle pieces come alive, each representing a family member with their own special personality!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Family</span>
                                <span class="story-tag">Creativity</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal5" data-category="family" data-age="3-7">
                        <div class="story-content">
                            <h3>The Super-Sticky Hug Team!</h3>
                            <div class="story-section">
                                <img src="images/story5_beginning.jpg" alt="Magical hugs with sparkles" class="story-image">
                                <p class="story-text">Magical hugs that stick with you forever, helping you through any challenge!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Family</span>
                                <span class="story-tag">Magic</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal6" data-category="family" data-age="3-7">
                        <div class="story-content">
                            <h3>The Family Tech Team</h3>
                            <div class="story-section">
                                <img src="images/story6_beginning.jpg" alt="Tablet coming to life" class="story-image">
                                <p class="story-text">Magical tech gadgets turn screen time into family time and make learning fun!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Personal Growth</span>
                                <span class="story-tag">Innovation</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal7" data-category="random" data-age="3-7">
                        <div class="story-content">
                            <h3>The Musical Magic Makers!</h3>
                            <div class="story-section">
                                <img src="images/story7_beginning.jpg" alt="Piano coming to life" class="story-image">
                                <p class="story-text">Instruments come alive with big personalities, turning music into magical adventures!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Random Acts</span>
                                <span class="story-tag">Family</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal8" data-category="growth" data-age="3-7">
                        <div class="story-content">
                            <h3>The Book Buddy Brigade!</h3>
                            <div class="story-section">
                                <img src="images/story8_beginning.jpg" alt="Books coming to life" class="story-image">
                                <p class="story-text">Books jump and dance, telling the silliest stories and making reading magical!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Personal Growth</span>
                                <span class="story-tag">Creativity</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal9" data-category="family" data-age="3-7">
                        <div class="story-content">
                            <h3>The Photo Frame Friends</h3>
                            <div class="story-section">
                                <img src="images/story9_beginning.jpg" alt="Photo frames coming to life" class="story-image">
                                <p class="story-text">Magical frames bring memories to life, making them dance right off the walls!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Family</span>
                                <span class="story-tag">Magic</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal10" data-category="daily" data-age="3-7">
                        <div class="story-content">
                            <h3>The Musical Magic Makers</h3>
                            <div class="story-section">
                                <img src="images/story10_beginning.jpg" alt="Instruments coming to life" class="story-image">
                                <p class="story-text">Magical instruments with big personalities make music time an adventure!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Random Acts</span>
                                <span class="story-tag">Family</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal11" data-category="growth" data-age="3-7">
                        <div class="story-content">
                            <h3>The Book Buddy Brigade</h3>
                            <div class="story-section">
                                <img src="images/story11_beginning.jpg" alt="Books coming to life" class="story-image">
                                <p class="story-text">Books come alive to jump, dance, and tell the silliest stories ever!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Personal Growth</span>
                                <span class="story-tag">Creativity</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal12" data-category="family" data-age="3-7">
                        <div class="story-content">
                            <h3>The TV Time Team!</h3>
                            <div class="story-section">
                                <img src="images/story13.png" alt="TV coming to life" class="story-image">
                                <p class="story-text">A magical remote creates shows that make family time extra special!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Family</span>
                                <span class="story-tag">Magic</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal13" data-category="family" data-age="3-7">
                        <div class="story-content">
                            <h3>The Sparkle House Family</h3>
                            <div class="story-section">
                                <img src="images/story14.png" alt="Sparkle house" class="story-image">
                                <p class="story-text">A magical house that sparkles brighter than a disco ball brings joy to everyone who visits!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Family</span>
                                <span class="story-tag">Magic</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal16" data-category="daily" data-age="3-7">
                        <div class="story-content">
                            <h3>The Bedtime Book Buddies!</h3>
                            <div class="story-section">
                                <img src="images/story16.png" alt="Books coming to life" class="story-image">
                                <p class="story-text">Books wake up at night to make bedtime the most magical time of day!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Bedtime</span>
                                <span class="story-tag">Magic</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal17" data-category="family" data-age="3-7">
                        <div class="story-content">
                            <h3>The Pet Tech Team!</h3>
                            <div class="story-section">
                                <img src="images/story17.png" alt="Pets using technology" class="story-image">
                                <p class="story-text">Pets use technology to help others and spread joy through their special abilities!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Family Moments</span>
                                <span class="story-tag">Innovation</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal18" data-category="daily" data-age="3-7">
                        <div class="story-content">
                            <h3>The Laundry Day Llamas!</h3>
                            <div class="story-section">
                                <img src="images/story18.png" alt="Laundry llamas" class="story-image">
                                <p class="story-text">Laundry llamas fold clothes into origami and turn laundry day into a fashion show!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Family</span>
                                <span class="story-tag">Fun</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal19" data-category="nature" data-age="3-7">
                        <div class="story-content">
                            <h3>The Garden Growth Gang!</h3>
                            <div class="story-section">
                                <img src="images/story19.png" alt="Garden coming to life" class="story-image">
                                <p class="story-text">Magical plants make sure every seed grows into something special!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Nature</span>
                                <span class="story-tag">Magic</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal20" data-category="family" data-age="3-7">
                        <div class="story-content">
                            <h3>The Family Fun Factory!</h3>
                            <div class="story-section">
                                <img src="images/story20.png" alt="House coming to life" class="story-image">
                                <p class="story-text">A magical house where every room transforms into an exciting adventure!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Family</span>
                                <span class="story-tag">Adventure</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal15" data-category="creativity" data-age="3-7">
                        <div class="story-content">
                            <h3>The Art Adventure Squad!</h3>
                            <div class="story-section">
                                <img src="images/story15.png" alt="Art supplies coming to life" class="story-image">
                                <p class="story-text">Art supplies come alive as a happy family of frame friends with special powers!</p>
                            </div>
                            <div class="story-tags">
                                <span class="story-tag">Creativity</span>
                                <span class="story-tag">Fun</span>
                            </div>
                        </div>
                        <div class="age-badge">3-7</div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Story Modals -->
    <div class="modal fade story-modal" id="storyModal1" tabindex="-1" aria-labelledby="storyModal1Label" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="storyModal1Label">The Super Sparkle Family!</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
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

    <div class="modal fade story-modal" id="storyModal2" tabindex="-1" aria-labelledby="storyModal2Label" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="storyModal2Label">Elijah's Kitchen of Culinary Craziness</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
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

    <div class="modal fade story-modal" id="storyModal3" tabindex="-1" aria-labelledby="storyModal3Label" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="storyModal3Label">The Sparkle Family's Giggle-Wiggle Kindness Calendar</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story3_beginning.jpg" alt="Magical calendar with eyeballs" class="modal-image">
                        <p>The Sparkle Family wasn't just any regular family. OH NO! They had SPARKLY TOES that left tiny glitter trails wherever they walked. Even their pet goldfish, Bubbles, had sparkly fins that made the water look like a disco ball!</p>
                        
                        <img src="images/story3_middle.jpg" alt="Calendar doing the chicken dance" class="modal-image">
                        <p>Every morning, the Sparkle Family would check their special Kindness Calendar hanging in the kitchen. But this wasn't your ordinary, boring calendar with squares and numbers. NOPE! This calendar had EYEBALLS that blinked and a MOUTH that went "MWAH-MWAH-GOOD MORNING!" whenever someone touched it.</p>
                        
                        <img src="images/story3_end.jpg" alt="Family group hug with sparkles" class="modal-image">
                        <p>"Being kind is the SILLIEST, FUNNEST thing EVER!" declared Ezra as he watched the stars from the calendar chase the rainbow around the living room. And the whole Sparkle Family agreed—with a SUPER-DUPER group hug that was so powerful, it made their sparkly toes light up like tiny fireworks!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal4" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Reuel's Wacky Puzzle Family!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story4_beginning.jpg" alt="Puzzle pieces coming to life" class="modal-image">
                        <p>Reuel loved puzzles, but he never expected his puzzle pieces to come to life! Each piece represented a member of his family, and they all had their own personalities.</p>
                        
                        <img src="images/story4_middle.jpg" alt="Family puzzle pieces dancing" class="modal-image">
                        <p>There was Papa and Nana's piece, strong and wise. Trinity's piece was creative and kind, while Mariah's piece was full of energy. Veronica's piece brought laughter, and Elijah's piece was always cooking up new ideas.</p>
                        
                        <img src="images/story4_end.jpg" alt="Complete family puzzle" class="modal-image">
                        <p>As Reuel put the puzzle together, he discovered that each piece was unique and important. Just like in his real family, every piece fit together perfectly to create a beautiful picture of love and support!</p>
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
                    <div class="story-content">
                        <img src="images/story5_beginning.jpg" alt="Magical hugs with sparkles" class="modal-image">
                        <p>Papa and Nana had a special power - their hugs were so full of love that they stuck with you forever! When they hugged someone, a little bit of their love magic would stay with them, helping them through any challenge.</p>
                        
                        <img src="images/story5_middle.jpg" alt="Love magic chain reaction" class="modal-image">
                        <p>Their hugs helped Trinity find strength when she needed it most, gave Elijah confidence in the kitchen, and helped Reuel solve his trickiest puzzles. The magic spread to everyone in the family!</p>
                        
                        <img src="images/story5_end.jpg" alt="House filled with joy and laughter" class="modal-image">
                        <p>The Super-Sticky Hug Team taught everyone that the best kind of magic is the love we share with our family. And that's why their hugs will always be remembered as the most magical hugs in the world!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal6" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Family Tech Team</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story6_beginning.jpg" alt="Tablet coming to life" class="modal-image">
                        <p>The family's tech gadgets weren't just regular, boring devices that sat on shelves. OH NO! They were magical machines that could turn screen time into family time and make learning as fun as a game of hide-and-seek!</p>
                        
                        <img src="images/story6_middle.jpg" alt="Tech Team helping with learning" class="modal-image">
                        <p>Each device had its own special power: Tablet Tina made lessons come alive, Computer Charlie turned games into adventures, and Phone Phil made family calls feel like magic.</p>
                        
                        <img src="images/story6_end.jpg" alt="Family learning with Tech Team" class="modal-image">
                        <p>The Tech Team taught everyone that the best learning is the kind you share with your family! And that's exactly what they did every single day!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal7" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Bedtime Story Stars</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story7_beginning.jpg" alt="Books coming to life" class="modal-image">
                        <p>Noah's bedtime books weren't just regular, boring books that sat on shelves. OH NO! They were magical story stars that could turn bedtime into the most exciting adventure of the day!</p>
                        
                        <img src="images/story7_middle.jpg" alt="Magical storytelling" class="modal-image">
                        <p>Each story had its own special power: Fairy Tale Fiona could make dreams dance, Adventure Andy turned bedtime into stories, and Lullaby Lucy made sleeping magical!</p>
                        
                        <img src="images/story7_end.jpg" alt="Family bedtime" class="modal-image">
                        <p>The Bedtime Story Stars showed everyone that bedtime isn't just about sleeping - it's about sharing magical moments together as a family!</p>
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
                    <div class="story-content">
                        <img src="images/story8_beginning.jpg" alt="Magical toy box coming to life" class="modal-image">
                        <p>In a house that looked like it had been painted by a rainbow with hiccups lived the Fun Factory Family. OH NO! They weren't called that because they made boring old toys. They were called the Fun Factory Family because they had a magical machine that could turn ANYTHING into fun!</p>
                        
                        <img src="images/story8_middle.jpg" alt="Fun Factory Team adventures" class="modal-image">
                        <p>Each room had its own special power: Playful Patty the Playroom could turn toys into real-life adventures, Kitchen King Karl made cooking magical, and Bedroom Buddy Bella transformed bedtime into a dreamy journey.</p>
                        
                        <img src="images/story8_end.jpg" alt="Family fun with the Fun Factory Team" class="modal-image">
                        <p>The best part was that the house taught everyone that family time isn't just about being together—it's about creating magical moments that make everyone smile!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal9" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Photo Frame Friends</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story9_beginning.jpg" alt="Photo frames coming to life" class="modal-image">
                        <p>The family's photo frames weren't just regular, boring frames that held still pictures. OH NO! They were magical frames that could bring memories to life and make them dance right off the walls!</p>
                        
                        <img src="images/story9_middle.jpg" alt="Frames sharing memories" class="modal-image">
                        <p class="story-text">Each frame had its own special power: Memory Molly the Beach Frame could make beach days come alive, Vacation Vicky the Travel Frame could make trips feel real, and Birthday Benny the Party Frame could make celebrations sparkle!</p>
                        
                        <img src="images/story9_end.jpg" alt="Family enjoying memories" class="modal-image">
                        <p class="story-text">The Photo Frame Friends taught everyone that memories aren't just about looking at pictures—they're about feeling the joy and love in every moment we share with our family!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal10" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Musical Magic Makers</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story10_beginning.jpg" alt="Instruments coming to life" class="modal-image">
                        <p>The family's musical instruments weren't just regular, boring objects that sat in cases. OH NO! They were magical music makers that could turn any day into a concert!</p>
                        
                        <img src="images/story10_middle.jpg" alt="Musical adventures" class="modal-image">
                        <p>Each instrument had its own special power: Piano Pete could make dreams dance, Guitar Grace turned songs into adventures, and Drum Dave made rhythms feel like magic!</p>
                        
                        <img src="images/story10_end.jpg" alt="Family music time" class="modal-image">
                        <p>The Musical Magic Makers taught everyone that music isn't just about playing notes—it's about sharing joy and creating magical moments together!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal11" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Book Buddy Brigade</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story11_beginning.jpg" alt="Books coming to life" class="modal-image">
                        <p>The family's books weren't just regular, boring books that sat on shelves. OH NO! They were magical story buddies that could turn reading into the most exciting adventure!</p>
                        
                        <img src="images/story11_middle.jpg" alt="Book adventures" class="modal-image">
                        <p>Each book had its own special power: Story Sam could make characters dance, Adventure Amy turned pages into portals, and Learning Lucy made knowledge feel like magic!</p>
                        
                        <img src="images/story11_end.jpg" alt="Family reading time" class="modal-image">
                        <p>The Book Buddy Brigade taught everyone that reading isn't just about words on a page—it's about using your IMAGINATION to make stories come alive!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal12" tabindex="-1">
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

    <div class="modal fade story-modal" id="storyModal13" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Sparkle House Family</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story14.png" alt="Sparkle house" class="modal-image">
                        <p>The Sparkle House wasn't just any regular house. OH NO! It was a magical home that sparkled brighter than a disco ball at a dance party! Every window twinkled like stars, and the walls glowed with rainbow colors.</p>
                        
                        <img src="images/story14_middle.jpg" alt="Family in sparkle house" class="modal-image">
                        <p>The house had special powers: it could make rainy days sunny, turn frowns into smiles, and create the most magical family moments ever!</p>
                        
                        <img src="images/story14_end.jpg" alt="Sparkle house at night" class="modal-image">
                        <p>The Sparkle House taught everyone that home isn't just a place to live—it's where love and magic come together to create the most wonderful memories!</p>
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
                    <div class="story-content">
                        <img src="images/story16.png" alt="Books coming to life" class="modal-image">
                        <p>Every night, when the moon was high and the stars were twinkling like tiny flashlights, something MAGICAL happened in little Noah's bedroom. His books would wake up from their daytime naps and become his very own BEDTIME BOOK BUDDIES!</p>
                        
                        <img src="images/story16_middle.jpg" alt="Books telling stories" class="modal-image">
                        <p>Each book had its own special bedtime power: Dreamy Dora could make the room feel cozy, Sleepy Sam turned the ceiling into a galaxy, and Lullaby Lucy sang the sweetest bedtime songs!</p>
                        
                        <img src="images/story16_end.jpg" alt="Peaceful bedtime" class="modal-image">
                        <p>The Book Buddies taught Noah that bedtime isn't just about sleeping—it's about having magical moments with your favorite stories!</p>
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
                    <div class="story-content">
                        <img src="images/story17.png" alt="Pets using technology" class="modal-image">
                        <p>The family's pets weren't just regular, boring animals that sat around all day. OH NO! They were magical tech experts who could use technology to help others!</p>
                        
                        <img src="images/story17_middle.jpg" alt="Pets helping with technology" class="modal-image">
                        <p>Each pet had its own special power: Computer Cat could fix any tech problem, Tablet Turtle made learning fun, and Phone Puppy could connect people with love!</p>
                        
                        <img src="images/story17_end.jpg" alt="Family with tech-savvy pets" class="modal-image">
                        <p>The Pet Tech Team taught everyone that technology isn't just about screens—it's about using it to help others and spread joy!</p>
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
                    <div class="story-content">
                        <img src="images/story18.png" alt="Laundry llamas" class="modal-image">
                        <p>The family's laundry wasn't just regular, boring clothes that needed washing. OH NO! It was a magical fashion show with llamas as the stars!</p>
                        
                        <img src="images/story18_middle.jpg" alt="Llamas folding clothes" class="modal-image">
                        <p>Each llama had its own special power: Folding Fred could turn clothes into origami, Washing Wendy made bubbles dance, and Drying Danny created rainbow steam!</p>
                        
                        <img src="images/story18_end.jpg" alt="Family fashion show" class="modal-image">
                        <p>The Laundry Day Llamas taught everyone that chores aren't just about cleaning—they're about making everyday tasks magical and fun!</p>
                    </div>
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
                    <div class="story-content">
                        <img src="images/story19.png" alt="Garden coming to life" class="modal-image">
                        <p>The family's garden wasn't just regular, boring plants that grew in the ground. OH NO! It was a magical place where plants could talk and dance!</p>
                        
                        <img src="images/story19_middle.jpg" alt="Magical plants growing" class="modal-image">
                        <p>Each plant had its own special power: Flower Fiona could make colors dance, Tree Tommy turned seeds into treasures, and Herb Harry made gardening magical!</p>
                        
                        <img src="images/story19_end.jpg" alt="Family in magical garden" class="modal-image">
                        <p>The Garden Growth Gang taught everyone that growing plants isn't just about dirt—it's about watching magic happen right before your eyes!</p>
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
                    <div class="story-content">
                        <img src="images/story20.png" alt="House coming to life" class="modal-image">
                        <p>The family's house wasn't just regular, boring rooms with walls and doors. OH NO! It was a magical factory that could turn any room into an adventure!</p>
                        
                        <img src="images/story20_middle.jpg" alt="Magical room transformations" class="modal-image">
                        <p>Each room had its own special power: Playroom Patty could turn toys into real adventures, Kitchen Karl made cooking magical, and Bedroom Bella transformed bedtime into dreams!</p>
                        
                        <img src="images/story20_end.jpg" alt="Family in transformed house" class="modal-image">
                        <p>The Family Fun Factory taught everyone that home isn't just a place to live—it's where magic happens every single day!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal15" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>The Art Adventure Squad!</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="story-content">
                        <img src="images/story15.png" alt="Art supplies coming to life" class="modal-image">
                        <p>The family's art supplies weren't just regular, boring tools that sat in a box. OH NO! They were a big, happy family of FRAME FRIENDS who loved to share their favorite memories and tell the SILLIEST stories!</p>
                        
                        <img src="images/story15_middle.jpg" alt="Art supplies creating magic" class="modal-image">
                        <p>Each art supply had its own special power: Paintbrush Pete could make colors dance, Crayon Carol turned drawings into adventures, and Glue Gary made everything stick together in the most magical ways!</p>
                        
                        <img src="images/story15_end.jpg" alt="Family art time" class="modal-image">
                        <p>The Art Adventure Squad taught everyone that creativity isn't just about making art—it's about using your IMAGINATION to make the world more colorful and fun!</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Remove the Fixed Filter Menu -->
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
                this.classList.add('active');
            });
        });
    </script>
</body>
</html> 