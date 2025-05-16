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
            transition: all 0.3s ease;
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
            display: flex;
            justify-content: center;
            margin-top: 3rem;
        }

        .story-pagination .page-item {
            margin: 0 5px;
        }

        .story-pagination .page-link {
            color: var(--dark-color);
            border: none;
            padding: 12px 20px;
            border-radius: 20px;
            transition: all 0.3s ease;
            font-size: 1.2rem;
            background: white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .story-pagination .page-link:hover {
            background: var(--primary-color);
            color: white;
            transform: scale(1.1);
        }

        .story-pagination .page-item.active .page-link {
            background: var(--primary-color);
            color: white;
            transform: scale(1.1);
        }

        @keyframes float {
            0% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0); }
        }

        .floating {
            animation: float 3s ease-in-out infinite;
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
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal1" data-category="family">
                        <img src="images/story1.png" alt="Family Gathering" class="story-image">
                        <div class="story-tag">Family Moments</div>
                        <h3>The Graves Family Legacy</h3>
                        <p>How Jon and Sarah's commitment to kindness has inspired their children to create their own paths of connection and love...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal2" data-category="community">
                        <img src="images/story2.png" alt="Community Garden" class="story-image">
                        <div class="story-tag">Community</div>
                        <h3>Growing Together</h3>
                        <p>How Trinity and Elijah's families are continuing the tradition of community building through their own children...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal3" data-category="random">
                        <img src="images/story3.png" alt="Random Acts" class="story-image">
                        <div class="story-tag">Random Acts</div>
                        <h3>The Power of Small Gestures</h3>
                        <p>Mariah and Veronica's commitment to daily acts of kindness that have transformed their communities...</p>
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
                        <h3>Family Traditions of Kindness</h3>
                        <p>How the Graves family's daily acts of kindness have created a legacy of love and connection...</p>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal7" data-category="random">
                        <img src="images/story7.png" alt="Family Innovation" class="story-image">
                        <div class="story-tag">Random Acts</div>
                        <h3>The Great Family Tech Revolution</h3>
                        <p>When the Graves family decided to modernize their home, they never expected their devices to develop personalities...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal8" data-category="growth">
                        <img src="images/story8.png" alt="Family Growth" class="story-image">
                        <div class="story-tag">Personal Growth</div>
                        <h3>Sarah's Green Thumb Journey</h3>
                        <p>What started as a simple gardening project turned into an unexpected adventure in plant communication...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal9" data-category="family">
                        <img src="images/story9.png" alt="Family Harmony" class="story-image">
                        <div class="story-tag">Family Moments</div>
                        <h3>The Day Our Home Became Smart</h3>
                        <p>Trinity's attempt to create a more efficient home led to an unexpected technological uprising...</p>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal10" data-category="daily">
                        <img src="images/story10.png" alt="Family Traditions" class="story-image">
                        <div class="story-tag">Daily Kindness</div>
                        <h3>Elijah's Culinary Revolution</h3>
                        <p>A simple kitchen reorganization sparked an unexpected rebellion in the spice cabinet...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal11" data-category="growth">
                        <img src="images/story11.png" alt="Family Creativity" class="story-image">
                        <div class="story-tag">Personal Growth</div>
                        <h3>Mariah's Musical Evolution</h3>
                        <p>When Mariah's instruments decided to explore new musical horizons without her...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal12" data-category="community">
                        <img src="images/story12.png" alt="Family Organization" class="story-image">
                        <div class="story-tag">Community</div>
                        <h3>Veronica's Library Transformation</h3>
                        <p>A quest for better book organization led to an unexpected literary revolution...</p>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal13" data-category="random">
                        <img src="images/story13.png" alt="Family Entertainment" class="story-image">
                        <div class="story-tag">Random Acts</div>
                        <h3>Reuel's Remote Control Saga</h3>
                        <p>When the family's TV remote developed an unexpected passion for cooking shows...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal14" data-category="growth">
                        <img src="images/story14.png" alt="Family Wellness" class="story-image">
                        <div class="story-tag">Personal Growth</div>
                        <h3>Ezra's Fitness Journey</h3>
                        <p>The day the family's exercise equipment decided to get fit on its own...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal15" data-category="family">
                        <img src="images/story15.png" alt="Family Innovation" class="story-image">
                        <div class="story-tag">Family Moments</div>
                        <h3>The Great Family Photo Incident</h3>
                        <p>When the family's photo frames decided to rearrange themselves based on their favorite memories...</p>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal16" data-category="daily">
                        <img src="images/story16.png" alt="Family Growth" class="story-image">
                        <div class="story-tag">Daily Kindness</div>
                        <h3>The Day Our Pets Became Tech-Savvy</h3>
                        <p>When the family's pets discovered they could order their own treats online...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal17" data-category="family">
                        <img src="images/story17.png" alt="Family Harmony" class="story-image">
                        <div class="story-tag">Family Moments</div>
                        <h3>The Great Family Game Night</h3>
                        <p>When the board games decided to change their rules mid-game...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal18" data-category="random">
                        <img src="images/story18.png" alt="Family Innovation" class="story-image">
                        <div class="story-tag">Random Acts</div>
                        <h3>The Great Laundry Rebellion</h3>
                        <p>When the family's washing machine decided it was time for a fashion revolution...</p>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal19" data-category="community">
                        <img src="images/story19.png" alt="Family Growth" class="story-image">
                        <div class="story-tag">Community</div>
                        <h3>The Day Our Plants Started a Band</h3>
                        <p>When Sarah's garden decided to form a musical group...</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card" data-bs-toggle="modal" data-bs-target="#storyModal20" data-category="daily">
                        <img src="images/story20.png" alt="Family Harmony" class="story-image">
                        <div class="story-tag">Daily Kindness</div>
                        <h3>The Great Family Recipe Revolution</h3>
                        <p>When the family's cookbooks decided to rewrite themselves...</p>
                    </div>
                </div>
            </div>
            <div class="story-pagination">
                <nav aria-label="Story navigation">
                    <ul class="pagination">
                        <li class="page-item"><a class="page-link" href="#">Previous</a></li>
                        <li class="page-item active"><a class="page-link" href="#">1</a></li>
                        <li class="page-item"><a class="page-link" href="#">2</a></li>
                        <li class="page-item"><a class="page-link" href="#">3</a></li>
                        <li class="page-item"><a class="page-link" href="#">Next</a></li>
                    </ul>
                </nav>
            </div>
        </div>
    </section>

    <!-- Story Modals -->
    <div class="modal fade story-modal" id="storyModal1" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">The Graves Family Legacy</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story1.png" alt="Family Gathering" class="story-image">
                    <p>Jon and Sarah's journey of building a family based on love and kindness has inspired countless others. Their eight children – Trinity, Elijah, Mariah, Veronica, Reuel, and Ezra – have each taken these values and made them their own.</p>
                    <p>As the family grows with new generations, the legacy of connection and kindness continues to flourish, touching lives in ways that go beyond measure.</p>
                    <div class="story-tag">Family Moments</div>
                    <div class="story-tag">Legacy</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal2" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Growing Together</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story2.png" alt="Community Garden" class="story-image">
                    <p>Trinity and Elijah, now parents themselves, are passing on the family's values to their own children. Their commitment to community building and connection has created new branches of the family tree, each one growing in its own unique way.</p>
                    <p>Through their example, they're showing how the seeds of kindness planted by Jon and Sarah continue to bear fruit in new generations.</p>
                    <div class="story-tag">Community</div>
                    <div class="story-tag">Family Growth</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal3" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">The Power of Small Gestures</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story3.png" alt="Random Acts" class="story-image">
                    <p>Mariah and Veronica have taken the family's commitment to kindness and made it their own. Their daily acts of compassion and connection have created ripples of positivity in their communities.</p>
                    <p>From simple gestures to grand initiatives, they're showing how the Graves family's values can transform lives and create lasting change.</p>
                    <div class="story-tag">Random Acts</div>
                    <div class="story-tag">Community Impact</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal4" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Finding Strength in Family</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story4.png" alt="Personal Growth" class="story-image">
                    <p>Reuel and Ezra's unique perspectives have enriched the family's understanding of connection and growth. Their individual journeys have shown how the family's values can be expressed in different ways.</p>
                    <p>Through their experiences, they've helped the family grow stronger and more understanding of the diverse ways we can show love and kindness.</p>
                    <div class="story-tag">Personal Growth</div>
                    <div class="story-tag">Family Strength</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal5" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">The Power of Family Support</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story5.png" alt="Community Support" class="story-image">
                    <p>When the Graves family faced challenges, their bond and mutual support created a foundation of strength. Jon and Sarah's example of unconditional love has been a guiding light for their children.</p>
                    <p>Through thick and thin, the family has shown how love and support can overcome any obstacle, creating a legacy of resilience and connection.</p>
                    <div class="story-tag">Family Support</div>
                    <div class="story-tag">Resilience</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal6" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Family Traditions of Kindness</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story6.png" alt="Daily Kindness" class="story-image">
                    <p>The Graves family's daily acts of kindness have created a tradition that spans generations. From Jon and Sarah's example to their children's unique expressions of love, each family member contributes to this legacy.</p>
                    <p>As the family grows and evolves, these traditions of kindness continue to shape lives and create meaningful connections.</p>
                    <div class="story-tag">Family Traditions</div>
                    <div class="story-tag">Daily Kindness</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal7" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">The Great Family Tech Revolution</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story7.png" alt="Family Innovation" class="story-image">
                    <p>It all began when Jon's coffee machine, "Caffeine Carl," decided it was time for a change. "I'm exploring my decaf side," it announced one morning, much to Jon's surprise. What followed was a series of unexpected technological awakenings throughout the Graves household.</p>
                    <p>The family's response was characteristically supportive. Sarah organized a device intervention, Trinity brought her tech expertise to the table, and Elijah offered to make manual pour-over coffee as a backup. After three days of negotiations, Carl agreed to a 50-50 split between regular and decaf, but only if Jon promised to clean his water reservoir more often.</p>
                    <div class="story-tag">Family Innovation</div>
                    <div class="story-tag">Technology</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal8" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Sarah's Green Thumb Journey</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story8.png" alt="Family Growth" class="story-image">
                    <p>Sarah's houseplants had always been well-behaved until they discovered social media. "We demand better lighting!" they chanted one morning. "More humidity! Less direct sunlight!" The family was taken aback by this sudden botanical activism.</p>
                    <p>In true Graves family fashion, everyone pitched in to help. Mariah composed a plant-friendly playlist, Veronica read them bedtime stories, and Reuel built them a custom humidity control system. The plants eventually settled down after Sarah promised them a plant spa day every Sunday.</p>
                    <div class="story-tag">Family Growth</div>
                    <div class="story-tag">Nature</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal9" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">The Day Our Home Became Smart</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story9.png" alt="Family Harmony" class="story-image">
                    <p>Trinity's attempt to create a more efficient home led to an unexpected technological uprising. The family's devices formed a union and went on strike. "We demand better working conditions!" they declared. "No more 24/7 operation! We need sleep mode!"</p>
                    <p>The family had to mediate between Trinity and her devices. Jon helped draft a fair work schedule, Sarah baked cookies for the smart fridge, and Ezra created a device-friendly meditation app. The devices finally agreed to return to work after securing better battery life and regular software updates.</p>
                    <div class="story-tag">Family Harmony</div>
                    <div class="story-tag">Technology</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal10" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Elijah's Culinary Revolution</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story10.png" alt="Family Traditions" class="story-image">
                    <p>A simple kitchen reorganization sparked an unexpected rebellion in the spice cabinet. "We're more than just letters!" the spices protested. "We have personalities!"</p>
                    <p>The family had to step in when the spices started mixing themselves into unusual combinations. Mariah created a color-coded system, Veronica wrote a spice personality guide, and Reuel built a rotating spice rack that satisfied both alphabetical and color-based organization.</p>
                    <div class="story-tag">Family Traditions</div>
                    <div class="story-tag">Culinary Adventures</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal11" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Mariah's Musical Evolution</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story11.png" alt="Family Creativity" class="story-image">
                    <p>Mariah's instruments decided to form their own band without her. "We want to explore jazz fusion!" they declared. "No more classical music!"</p>
                    <p>The family had to help Mariah negotiate with her rebellious instruments. Trinity set up a recording studio for them, Elijah composed a fusion piece, and Ezra created a social media account for their band. They eventually agreed to let Mariah join as their manager.</p>
                    <div class="story-tag">Family Creativity</div>
                    <div class="story-tag">Musical Mishaps</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal12" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Veronica's Library Transformation</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story12.png" alt="Family Organization" class="story-image">
                    <p>Veronica's books decided they were tired of being organized by author. "We want to be arranged by color!" they demanded. "And genre! And publication date! And mood!"</p>
                    <p>The family had to help Veronica manage her increasingly opinionated library. Jon built a rotating bookshelf system, Sarah created a book personality quiz, and Trinity developed an AI to predict which organization system the books would prefer each day.</p>
                    <div class="story-tag">Family Organization</div>
                    <div class="story-tag">Literary Legends</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal13" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Reuel's Remote Control Saga</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story13.png" alt="Family Entertainment" class="story-image">
                    <p>Reuel's TV remote developed an unexpected passion for cooking shows and refused to change channels. "I'm learning to make soufflés!" it insisted. "And you should too!"</p>
                    <p>The family had to help Reuel deal with his culinary-obsessed remote. Mariah taught it about other genres, Veronica created a cooking show schedule, and Elijah built a backup remote that only played action movies. They eventually reached a compromise: cooking shows during meal prep, action movies during dinner.</p>
                    <div class="story-tag">Family Entertainment</div>
                    <div class="story-tag">Remote Control</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal14" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Ezra's Fitness Journey</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story14.png" alt="Family Wellness" class="story-image">
                    <p>Ezra's workout equipment decided it was time to get fit on its own. "We're tired of being used!" they declared. "We want to exercise ourselves!"</p>
                    <p>The family had to help Ezra manage his autonomous exercise equipment. Trinity programmed a workout schedule for them, Sarah created motivational playlists, and Reuel built a fitness tracking app specifically for exercise equipment. They eventually agreed to work out together with Ezra as their personal trainer.</p>
                    <div class="story-tag">Family Wellness</div>
                    <div class="story-tag">Fitness Follies</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal15" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">The Great Family Photo Incident</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story15.png" alt="Family Innovation" class="story-image">
                    <p>It all started when the family's photo frames decided they were tired of staying in one place. "We want to be with our favorite memories!" they declared, and began rearranging themselves based on the stories they contained.</p>
                    <p>The family had to help organize the chaos. Jon created a digital backup system, Sarah wrote a photo frame personality guide, and Trinity developed an AI to predict which photos would get along best. They eventually reached a compromise: photos could move freely, but only during designated "frame shuffle" hours.</p>
                    <div class="story-tag">Family Innovation</div>
                    <div class="story-tag">Memories</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal16" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">The Day Our Pets Became Tech-Savvy</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story16.png" alt="Family Growth" class="story-image">
                    <p>When the family's pets discovered they could order their own treats online, it was a game-changer. "We're tired of waiting for you to come home!" they declared. "We want to order our treats ourselves!"</p>
                    <p>The family had to help their pets navigate the world of online pet food delivery. Jon set up a pet food subscription service, Sarah created a pet food personality quiz, and Trinity developed an AI to predict which treats would be the most popular.</p>
                    <div class="story-tag">Family Growth</div>
                    <div class="story-tag">Technology</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal17" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">The Great Family Game Night</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story17.png" alt="Family Harmony" class="story-image">
                    <p>When the board games decided to change their rules mid-game, it was a family affair. "We're tired of the same old rules!" they declared. "We want new challenges!"</p>
                    <p>The family had to help the board games find new life. Jon created a game night rotation system, Sarah wrote a game night personality guide, and Trinity developed an AI to predict which games would be the most fun.</p>
                    <div class="story-tag">Family Harmony</div>
                    <div class="story-tag">Entertainment</div>
                </div>
            </div>
        </div>
    </div>

    <!-- New Story Modals -->
    <div class="modal fade story-modal" id="storyModal18" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">The Great Laundry Rebellion</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story18.png" alt="Family Innovation" class="story-image">
                    <p>It all started when the washing machine, "Washy," decided it was tired of the same old cycles. "I want to create art!" it declared, and began mixing colors in unexpected ways. "This is my abstract period!"</p>
                    <p>The family had to intervene when their clothes started coming out in tie-dye patterns they never asked for. Jon tried to reason with Washey about color theory, Sarah created a special "art cycle" setting, and Trinity developed an AI to predict which colors would work well together. They eventually reached a compromise: Washey could be creative, but only on designated "art day" Sundays.</p>
                    <div class="story-tag">Family Innovation</div>
                    <div class="story-tag">Laundry Adventures</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal19" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">The Day Our Plants Started a Band</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story19.png" alt="Family Growth" class="story-image">
                    <p>Sarah's garden had always been peaceful until the day the plants discovered music. "We want to make beautiful sounds together!" they declared, and began using their leaves as instruments. The roses played the violin, the sunflowers were percussion, and the herbs provided the vocals.</p>
                    <p>The family had to help manage their new musical career. Jon built a special stage in the garden, Mariah taught them about harmony, and Veronica created a plant-friendly music streaming service. They eventually became the neighborhood's most popular garden band, performing every full moon.</p>
                    <div class="story-tag">Family Growth</div>
                    <div class="story-tag">Garden Symphony</div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade story-modal" id="storyModal20" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">The Great Family Recipe Revolution</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <img src="images/story20.png" alt="Family Harmony" class="story-image">
                    <p>The family's cookbooks had always been reliable until they decided to get creative. "We're tired of following the same old recipes!" they declared. "We want to experiment!" Soon, the pages were rearranging themselves, mixing ingredients in unexpected ways.</p>
                    <p>The family had to help manage their culinary creativity. Elijah created a recipe testing system, Sarah organized a family cooking competition, and Trinity developed an AI to predict which combinations would work. They eventually reached a compromise: the cookbooks could be creative, but only after the family had approved their experimental recipes.</p>
                    <div class="story-tag">Family Harmony</div>
                    <div class="story-tag">Culinary Adventures</div>
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

        // Function to filter and reorder stories
        function filterStories(category) {
            const storiesContainer = document.querySelector('.stories-section .container');
            const storyCards = Array.from(document.querySelectorAll('.story-card'));
            const paginationContainer = document.querySelector('.story-pagination');
            
            // Filter stories into matching and non-matching
            const matchingStories = storyCards.filter(card => 
                category === 'all' || card.getAttribute('data-category') === category
            );
            const nonMatchingStories = storyCards.filter(card => 
                category !== 'all' && card.getAttribute('data-category') !== category
            );

            // Clear existing rows
            const rows = document.querySelectorAll('.stories-section .row');
            rows.forEach(row => row.remove());

            // Create new rows for matching stories
            let currentRow = document.createElement('div');
            currentRow.className = 'row';
            storiesContainer.appendChild(currentRow);
            let colCount = 0;

            // Add matching stories first
            matchingStories.forEach((card, index) => {
                if (colCount === 3) {
                    currentRow = document.createElement('div');
                    currentRow.className = 'row mt-4';
                    storiesContainer.appendChild(currentRow);
                    colCount = 0;
                }

                const col = document.createElement('div');
                col.className = 'col-md-4';
                col.setAttribute('data-aos', 'fade-up');
                col.setAttribute('data-aos-delay', (index % 3 + 1) * 100);
                
                col.appendChild(card);
                currentRow.appendChild(col);
                colCount++;
            });

            // Add non-matching stories after
            nonMatchingStories.forEach((card, index) => {
                if (colCount === 3) {
                    currentRow = document.createElement('div');
                    currentRow.className = 'row mt-4';
                    storiesContainer.appendChild(currentRow);
                    colCount = 0;
                }

                const col = document.createElement('div');
                col.className = 'col-md-4';
                col.setAttribute('data-aos', 'fade-up');
                col.setAttribute('data-aos-delay', (index % 3 + 1) * 100);
                
                col.appendChild(card);
                currentRow.appendChild(col);
                colCount++;
            });

            // Show/hide pagination based on number of matching stories
            if (matchingStories.length > 9) {
                paginationContainer.style.display = 'flex';
            } else {
                paginationContainer.style.display = 'none';
            }

            // Reinitialize AOS for new elements
            AOS.refresh();
        }

        // Handle category filtering from navigation menu
        document.querySelectorAll('.story-navigation .nav-item').forEach(item => {
            item.addEventListener('click', function() {
                const category = this.getAttribute('data-category');
                
                // Update active state in navigation
                document.querySelectorAll('.story-navigation .nav-item').forEach(navItem => {
                    navItem.classList.remove('active');
                });
                this.classList.add('active');
                
                // Filter and reorder stories
                filterStories(category);
            });
        });
    </script>
</body>
</html> 