<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>catn8.us - Weaving Threads of Kindness</title>
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

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Comic Sans MS', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: var(--dark-color);
            background-color: var(--light-color);
            overflow-x: hidden;
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

        .navbar-toggler {
            border-color: var(--dark-color);
        }

        .navbar-toggler-icon {
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba(44, 62, 80, 1)' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
        }

        .hero {
            min-height: 100vh;
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            position: relative;
            overflow: hidden;
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

        @keyframes float {
            0% { transform: translateY(0); }
            100% { transform: translateY(-100%); }
        }

        .hero-content {
            position: relative;
            z-index: 1;
            padding: 2rem;
            color: white;
            text-align: center;
        }

        .welcome-message {
            font-family: 'Comic Sans MS', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin-bottom: 2rem;
            background: rgba(0, 0, 0, 0.6);
            padding: 2rem;
            border-radius: 15px;
            backdrop-filter: blur(10px);
        }

        .family-image {
            width: 100%;
            max-width: 500px;
            border-radius: 15px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            border: 3px solid var(--accent-color);
            margin: 2rem auto;
            display: block;
        }

        @media (min-width: 768px) {
            .hero-content .row {
                align-items: center;
            }
            .family-image {
                margin: 0;
            }
        }

        .welcome-message h1 {
            font-size: 3.5rem;
            margin-bottom: 1rem;
            text-transform: uppercase;
            letter-spacing: 0.2em;
        }

        .welcome-message .subtitle {
            font-size: 1.5rem;
            margin-bottom: 1rem;
            color: var(--accent-color);
        }

        .welcome-message .message {
            font-size: 1.2rem;
            font-style: italic;
            max-width: 800px;
            margin: 0 auto;
        }

        .guiding-lights {
            padding: 5rem 0;
            background: var(--dark-color);
            color: white;
        }

        .light-card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 2rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(5px);
            transition: transform 0.3s ease;
        }

        .light-card:hover {
            transform: translateY(-10px);
        }

        .light-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            color: var(--accent-color);
        }

        .invitation-section {
            padding: 5rem 0;
            background: linear-gradient(135deg, var(--secondary-color), var(--primary-color));
            color: white;
        }

        .invitation-content {
            background: rgba(255, 255, 255, 0.1);
            padding: 2rem;
            border-radius: 15px;
            backdrop-filter: blur(5px);
        }

        .floating-elements {
            position: absolute;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }

        .floating-element {
            position: absolute;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            animation: float-around 20s infinite linear;
        }

        @keyframes float-around {
            0% { transform: translate(0, 0) rotate(0deg); }
            25% { transform: translate(100px, 100px) rotate(90deg); }
            50% { transform: translate(0, 200px) rotate(180deg); }
            75% { transform: translate(-100px, 100px) rotate(270deg); }
            100% { transform: translate(0, 0) rotate(360deg); }
        }

        .dictionary-definition {
            font-family: 'Comic Sans MS', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 1.2rem;
            color: var(--dark-color);
            margin: 2rem 0;
            text-align: center;
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
        <div class="floating-elements">
            <div class="floating-element" style="width: 100px; height: 100px; top: 20%; left: 10%;"></div>
            <div class="floating-element" style="width: 150px; height: 150px; top: 60%; left: 80%;"></div>
            <div class="floating-element" style="width: 80px; height: 80px; top: 80%; left: 30%;"></div>
        </div>
        <div class="container hero-content">
            <div class="row">
                <div class="col-md-6" data-aos="fade-right">
                    <img src="images/catfamily.jpeg" alt="The Graves Family" class="family-image">
                </div>
                <div class="col-md-6" data-aos="fade-left">
                    <div class="welcome-message">
                        <h1>catn8.us</h1>
                        <div class="subtitle">Weaving Threads of Kindness, Together</div>
                        <div class="message">
                            <p>Welcome to a quiet haven in a bustling world. This is a space dedicated to the gentle arts of connection, the profound power of kindness, and the boundless warmth of love. We believe that by consciously linking our hearts and intentions, we can cultivate a more compassionate world, one heartfelt interaction at a time.</p>
                            <div class="dictionary-entry" style="margin-top: 2rem; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto; padding: 1rem; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
                                <h3 style="font-family: 'Comic Sans MS', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin-bottom: 0.5rem;">catenate</h3>
                                <p style="font-style: italic; margin-bottom: 0.5rem;">/ˈkatnˌāt/</p>
                                <p style="margin-bottom: 0.5rem;"><strong>verb</strong> (used with object)</p>
                                <p style="margin-bottom: 0.5rem;">1. to link together; form into a chain</p>
                                <p style="font-size: 0.9rem; color: var(--accent-color);">Synonyms: connect, link, join, unite, bind</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section id="guiding-lights" class="guiding-lights">
        <div class="container">
            <h2 class="text-center mb-5" data-aos="fade-up">Our Guiding Lights</h2>
            <div class="row">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="light-card">
                        <div class="light-icon">🤝</div>
                        <h3>The Art of Connection</h3>
                        <p>We cherish the beauty of genuine human connection – the kind that truly sees, hears, and values each soul. Here, we explore how to deepen our bonds through empathy, mindful listening, and the courage to be present with one another.</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="light-card">
                        <div class="light-icon">💝</div>
                        <h3>The Ripple of Kindness</h3>
                        <p>We believe in the transformative magic of kindness, understanding that every compassionate act, no matter its size, sends ripples of warmth and hope into the world. We champion the daily practice of extending grace to others and to ourselves.</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="light-card">
                        <div class="light-icon">🌱</div>
                        <h3>A Community of Love</h3>
                        <p>We aspire to nurture a community where love – expressed as acceptance, support, compassion, and mutual respect – forms the very foundation of our interactions. This is a space where hearts can feel safe, understood, and encouraged to flourish.</p>
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
                        <h2 class="text-center mb-4">Our Invitation-Based Circle</h2>
                        <p class="text-center mb-4">catn8.us is an intimate community, growing organically like a well-tended garden. New members are welcomed through personal invitations from those already within our circle, ensuring that our space continues to blossom with shared values and heartfelt intention. We believe this gentle approach helps us cultivate a sanctuary of trust and genuine connection.</p>
                        <p class="text-center">While our circle grows mindfully, the spirit of kindness and love we champion is a gift we hope resonates with all who visit.</p>
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
    </script>
</body>
</html>