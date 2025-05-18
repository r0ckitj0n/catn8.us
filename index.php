<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>catn8.us - A Fun Place for Families!</title>
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
            background-color: var(--light-color);
            overflow-x: hidden;
        }

        .navbar {
            background: rgba(255, 255, 255, 0.95);
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            border-bottom: 4px solid var(--accent-color);
        }

        .navbar-brand img {
            height: 50px;
            transition: transform 0.3s ease;
        }

        .navbar-brand img:hover {
            transform: scale(1.1);
        }

        .navbar-dark .navbar-nav .nav-link {
            color: var(--dark-color) !important;
            font-weight: 700;
            font-size: 20px;
            padding: 0.5rem 1rem;
            transition: all 0.3s ease;
            position: relative;
        }

        .navbar-dark .navbar-nav .nav-link::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 50%;
            width: 0;
            height: 3px;
            background: var(--primary-color);
            transition: all 0.3s ease;
            transform: translateX(-50%);
        }

        .navbar-dark .navbar-nav .nav-link:hover::after {
            width: 80%;
        }

        .navbar-dark .navbar-nav .nav-link:hover {
            color: var(--primary-color) !important;
            transform: translateY(-2px);
        }

        .hero {
            min-height: 100vh;
            background: linear-gradient(135deg, var(--fun-purple), var(--fun-green));
            position: relative;
            overflow: hidden;
            padding-top: 80px;
        }

        .hero::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('images/pattern.svg') repeat;
            opacity: 0.1;
            animation: float 20s linear infinite;
        }

        .bubble {
            position: absolute;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            animation: float-bubble 15s infinite ease-in-out;
        }

        @keyframes float-bubble {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
        }

        .hero-content {
            position: relative;
            z-index: 1;
            padding: 2rem;
            color: white;
        }

        .welcome-message {
            background: rgba(255, 255, 255, 0.15);
            padding: 2rem;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 4px solid var(--accent-color);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            transform-style: preserve-3d;
            transition: transform 0.3s ease;
        }

        .welcome-message:hover {
            transform: translateY(-5px) rotate(1deg);
        }

        .family-image {
            width: 100%;
            max-width: 500px;
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            border: 4px solid var(--accent-color);
            margin: 2rem auto;
            display: block;
            transition: transform 0.3s ease;
        }

        .family-image:hover {
            transform: scale(1.02);
        }

        .welcome-message h1 {
            font-size: 4rem;
            margin-bottom: 1rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--accent-color);
            text-shadow: 3px 3px 0 var(--dark-color);
        }

        .welcome-message .subtitle {
            font-size: 1.8rem;
            margin-bottom: 1.5rem;
            color: white;
            text-shadow: 2px 2px 0 var(--dark-color);
        }

        .welcome-message .message {
            font-size: 1.3rem;
            max-width: 800px;
            margin: 0 auto;
            line-height: 1.8;
        }

        .dictionary-entry {
            background: rgba(255, 255, 255, 0.2);
            padding: 1.5rem;
            border-radius: 15px;
            margin-top: 2rem;
            border: 3px solid var(--accent-color);
            transform: rotate(-1deg);
            transition: transform 0.3s ease;
        }

        .dictionary-entry:hover {
            transform: rotate(0deg) scale(1.02);
        }

        .dictionary-entry h3 {
            color: var(--accent-color);
            font-size: 2rem;
            margin-bottom: 0.5rem;
            text-shadow: 2px 2px 0 var(--dark-color);
        }

        .guiding-lights {
            padding: 5rem 0;
            background: linear-gradient(135deg, var(--fun-orange), var(--fun-purple));
            color: white;
            position: relative;
            overflow: hidden;
        }

        .light-card {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(5px);
            border: 3px solid var(--accent-color);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .light-card::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            transform: rotate(45deg);
            animation: shine 3s infinite;
        }

        @keyframes shine {
            0% { transform: rotate(45deg) translateY(-100%); }
            100% { transform: rotate(45deg) translateY(100%); }
        }

        .light-card:hover {
            transform: translateY(-10px) scale(1.02);
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .light-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
            color: var(--accent-color);
            text-shadow: 2px 2px 0 var(--dark-color);
            animation: bounce 2s infinite;
        }

        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }

        .invitation-section {
            padding: 5rem 0;
            background: linear-gradient(135deg, var(--fun-green), var(--fun-orange));
            color: white;
            position: relative;
            overflow: hidden;
        }

        .invitation-content {
            background: rgba(255, 255, 255, 0.15);
            padding: 3rem;
            border-radius: 20px;
            backdrop-filter: blur(5px);
            border: 4px solid var(--accent-color);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            transform-style: preserve-3d;
            transition: transform 0.3s ease;
        }

        .invitation-content:hover {
            transform: translateY(-5px) rotate(-1deg);
        }

        .section-title {
            font-size: 3rem;
            text-align: center;
            margin-bottom: 3rem;
            color: var(--accent-color);
            text-shadow: 3px 3px 0 var(--dark-color);
            position: relative;
            display: inline-block;
        }

        .section-title::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            height: 4px;
            background: var(--accent-color);
            border-radius: 2px;
        }

        @media (max-width: 768px) {
            .welcome-message h1 {
                font-size: 3rem;
            }
            .welcome-message .subtitle {
                font-size: 1.5rem;
            }
            .welcome-message .message {
                font-size: 1.1rem;
            }
        }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark fixed-top">
        <div class="container">
            <a class="navbar-brand" href="/">
                <img src="images/catn8_logo.jpeg" alt="catn8.us Logo" height="50">
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link active" href="/">Home</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="about.php">About</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="stories.php">Stories</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="games.php">Games</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="activities.php">Activities</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#guiding-lights">Our Lights</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#invitation">Our Circle</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <section class="hero">
        <div class="bubble" style="width: 100px; height: 100px; top: 20%; left: 10%;"></div>
        <div class="bubble" style="width: 150px; height: 150px; top: 60%; left: 80%;"></div>
        <div class="bubble" style="width: 80px; height: 80px; top: 80%; left: 30%;"></div>
        <div class="container hero-content">
            <div class="row align-items-center">
                <div class="col-md-6" data-aos="fade-right">
                    <img src="images/catfamily.jpeg" alt="The Graves Family" class="family-image">
                    <div class="image-caption mt-2 text-center" style="color: white; font-size: 1.2rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
                        Our family loves making new friends and sharing adventures!
                    </div>
                </div>
                <div class="col-md-6" data-aos="fade-left">
                    <div class="welcome-message">
                        <h1>catn8.us</h1>
                        <div class="subtitle">Where Fun Meets Family!</div>
                        <div class="message">
                            <p>Welcome to our magical corner of the internet! This is a special place where families come together to share stories, play games, and create wonderful memories. We believe that every day is an adventure waiting to happen, and we're here to make it extra special!</p>
                            <div class="dictionary-entry">
                                <h3>catenate</h3>
                                <p style="font-style: italic; margin-bottom: 0.5rem;">/ˈkatnˌāt/</p>
                                <p style="margin-bottom: 0.5rem;"><strong>verb</strong> (used with object)</p>
                                <p style="margin-bottom: 0.5rem;">1. to link together; form into a chain</p>
                                <p style="font-size: 1rem; color: var(--accent-color);">Synonyms: connect, link, join, unite, bind</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- What Makes Us Special Section -->
    <section class="what-makes-us-special py-5" style="background: linear-gradient(135deg, var(--fun-green), var(--fun-purple));">
        <div class="container">
            <h2 class="section-title text-center mb-5" data-aos="fade-up">What Makes Us Special</h2>
            <div class="row align-items-center mb-5">
                <div class="col-md-6" data-aos="fade-right">
                    <img src="images/homepage_friends.jpg" alt="Children playing together" class="img-fluid rounded shadow" style="max-width: 100%; border: 4px solid var(--accent-color);">
                    <div class="image-caption mt-3 text-center" style="color: white; font-size: 1.2rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
                        Making friends is what we do best!
                    </div>
                </div>
                <div class="col-md-6" data-aos="fade-left">
                    <div class="content-box p-4" style="background: rgba(255, 255, 255, 0.15); border-radius: 20px; backdrop-filter: blur(5px);">
                        <h3 class="mb-4" style="color: var(--accent-color);">Our Story</h3>
                        <p class="mb-4" style="color: white; font-size: 1.2rem;">We're a family that believes in the power of connection and kindness. Every day, we create new adventures and share them with friends like you. From playing games to reading stories, we make learning fun and friendship magical!</p>
                        <p style="color: white; font-size: 1.2rem;">Join us on this wonderful journey where every moment is a chance to learn, grow, and make new friends!</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section id="guiding-lights" class="guiding-lights">
        <div class="container">
            <h2 class="section-title" data-aos="fade-up">Our Guiding Lights</h2>
            <div class="row">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="light-card">
                        <div class="light-icon">🤝</div>
                        <h3>Making Friends</h3>
                        <p>We love making new friends and being kind to everyone! Here, we learn how to be good friends by sharing, listening, and helping each other. Every smile and kind word makes our world a happier place!</p>
                        <img src="images/homepage_growth.jpg" alt="Children learning and growing" class="img-fluid rounded shadow mt-3" style="max-width: 180px; border: 3px solid var(--fun-purple); background: white;">
                        <div class="image-caption mt-2" style="color: var(--accent-color); font-size: 1rem;">
                            Growing together, learning together!
                        </div>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="light-card">
                        <div class="light-icon">💝</div>
                        <h3>Spreading Joy</h3>
                        <p>Did you know that being kind is like spreading magic? Every time we do something nice, it makes someone else happy, and that happiness grows and grows! We love finding new ways to make others smile.</p>
                        <img src="images/homepage_kindness.jpg" alt="Acts of kindness" class="img-fluid rounded shadow mt-3" style="max-width: 180px; border: 3px solid var(--fun-green); background: white;">
                        <div class="image-caption mt-2" style="color: var(--accent-color); font-size: 1rem;">
                            Kindness is our superpower!
                        </div>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="light-card">
                        <div class="light-icon">🌱</div>
                        <h3>Growing Together</h3>
                        <p>Just like plants need water and sunshine to grow, we need love and friendship to grow into our best selves! Here, we help each other learn, play, and become the amazing people we're meant to be.</p>
                        <img src="images/homepage_family.jpg" alt="Happy family having fun" class="img-fluid rounded shadow mt-3" style="max-width: 180px; border: 3px solid var(--fun-orange); background: white;">
                        <div class="image-caption mt-2" style="color: var(--accent-color); font-size: 1rem;">
                            Family fun makes everything better!
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Adventure Section -->
    <section class="adventure-section py-5" style="background: linear-gradient(135deg, var(--fun-orange), var(--fun-purple));">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-md-6" data-aos="fade-right">
                    <div class="content-box p-4" style="background: rgba(255, 255, 255, 0.15); border-radius: 20px; backdrop-filter: blur(5px);">
                        <h3 class="mb-4" style="color: var(--accent-color);">Ready for Adventure?</h3>
                        <p class="mb-4" style="color: white; font-size: 1.2rem;">Every day is a new adventure waiting to happen! Whether we're exploring new stories, playing exciting games, or learning something new, we make sure it's always fun and full of surprises.</p>
                        <p style="color: white; font-size: 1.2rem;">Join us on this amazing journey where every moment is a chance to discover something wonderful!</p>
                    </div>
                </div>
                <div class="col-md-6" data-aos="fade-left">
                    <img src="images/homepage_adventure.jpg" alt="Children on an adventure" class="img-fluid rounded shadow" style="max-width: 100%; border: 4px solid var(--accent-color);">
                    <div class="image-caption mt-3 text-center" style="color: white; font-size: 1.2rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
                        Adventure awaits around every corner!
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section id="invitation" class="invitation-section">
        <div class="container">
            <div class="row justify-content-center">
                <div class="col-md-8">
                    <div class="invitation-content" data-aos="fade-up">
                        <h2 class="section-title">Join Our Family!</h2>
                        <p class="text-center mb-4">Welcome to our special family circle! We're like a big, friendly tree where everyone can find a branch to sit on. New friends join us through invitations from our current members, making sure our tree grows with love and care.</p>
                        <p class="text-center mb-4">We can't wait to meet you and share all the fun adventures waiting for us!</p>
                        <img src="images/homepage_family.jpg" alt="Family fun" class="img-fluid rounded shadow mt-4" style="max-width: 300px; border: 3px solid var(--accent-color); background: white;">
                        <div class="image-caption mt-3 text-center" style="color: white; font-size: 1.2rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
                            Together, we make the best memories!
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.js"></script>
    <script>
        AOS.init({
            duration: 1000,
            once: true
        });

        // Add floating bubbles
        function createBubbles() {
            const hero = document.querySelector('.hero');
            for (let i = 0; i < 10; i++) {
                const bubble = document.createElement('div');
                bubble.className = 'bubble';
                bubble.style.width = Math.random() * 100 + 50 + 'px';
                bubble.style.height = bubble.style.width;
                bubble.style.left = Math.random() * 100 + '%';
                bubble.style.top = Math.random() * 100 + '%';
                bubble.style.animationDelay = Math.random() * 5 + 's';
                hero.appendChild(bubble);
            }
        }

        createBubbles();
    </script>
</body>
</html>