<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About - catn8.us</title>
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

        .philosophy-section {
            padding: 5rem 0;
            background: var(--light-color);
        }

        .value-card {
            background: white;
            border-radius: 15px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }

        .value-card:hover {
            transform: translateY(-5px);
        }

        .value-icon {
            font-size: 3rem;
            margin-bottom: 1.5rem;
            color: var(--primary-color);
        }

        .value-card h3 {
            color: var(--dark-color);
            font-size: 1.5rem;
            margin-bottom: 1rem;
            font-weight: 600;
        }

        .value-card p {
            color: var(--dark-color);
            font-size: 1.1rem;
            line-height: 1.6;
        }

        .story-section {
            padding: 5rem 0;
            background: var(--dark-color);
            color: white;
        }

        .story-card {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 2rem;
            margin-bottom: 2rem;
            backdrop-filter: blur(5px);
        }

        .quote {
            font-style: italic;
            font-size: 1.2rem;
            color: var(--dark-color);
            margin: 2rem 0;
            text-align: center;
            background: rgba(255, 255, 255, 0.9);
            padding: 2rem;
            border-radius: 15px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .interactive-element {
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .interactive-element:hover {
            transform: scale(1.05);
        }

        @keyframes float {
            0% { transform: translateY(0); }
            100% { transform: translateY(-100%); }
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
                        <a class="nav-link active" href="about.php">About</a>
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
                    <h1>Our Philosophy</h1>
                    <p class="lead">At catn8.us, our name whispers our deepest aspiration: to catenate, to tenderly link together, not just ideas, but hearts. Founded by Jon and Sarah Graves, our community is built on the foundation of family, love, and connection.</p>
                </div>
            </div>
        </div>
    </section>

    <section class="philosophy-section">
        <div class="container">
            <div class="row">
                <div class="col-md-6" data-aos="fade-right">
                    <h2>Our Vision</h2>
                    <p>We dream of a world where empathy is a universal language, where acts of kindness are as natural as breathing, and where communities are sanctuaries built upon unconditional love and unwavering mutual support.</p>
                    <p>Through the example of our growing family – from Jon and Sarah to their children Trinity, Elijah, Mariah, Veronica, Reuel, and Ezra, and now to the next generation – we envision a future where every individual feels a deep sense of belonging.</p>
                </div>
                <div class="col-md-6" data-aos="fade-left">
                    <div class="quote">
                        "Family is not an important thing. It's everything."
                        <br>
                        <small>- Michael J. Fox</small>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="story-section">
        <div class="container">
            <h2 class="text-center mb-5" data-aos="fade-up">Our Core Values</h2>
            <div class="row">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="value-card interactive-element">
                        <div class="value-icon">💝</div>
                        <h3>Family First</h3>
                        <p>Following Jon and Sarah's example, we believe in putting family at the heart of everything we do, creating bonds that last through generations.</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="value-card interactive-element">
                        <div class="value-icon">🤝</div>
                        <h3>Empathy in Action</h3>
                        <p>From Trinity and Elijah's parenting to Mariah and Veronica's community work, we see how empathy transforms lives and builds stronger connections.</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="value-card interactive-element">
                        <div class="value-icon">🌱</div>
                        <h3>Gentle Growth</h3>
                        <p>Through Reuel and Ezra's unique perspectives, we've learned that growth comes in many forms, each beautiful in its own way.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="philosophy-section">
        <div class="container">
            <div class="row">
                <div class="col-md-8 mx-auto">
                    <div class="story-card" data-aos="fade-up">
                        <h2 class="text-center mb-4">Why This Path, Why Now?</h2>
                        <p>In an era often marked by rapid change, digital distance, and echoes of division, the Graves family's journey stands as a testament to the enduring power of connection. From Jon and Sarah's initial vision to their children's diverse expressions of love and kindness, we've seen how family values can create ripples of positive change.</p>
                        <p>catn8.us seeks to be a soft light in the fog, a nurturing space where these essential human qualities are not only remembered but actively cultivated and celebrated, just as they are in the Graves family.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="story-section">
        <div class="container">
            <h2 class="text-center mb-5" data-aos="fade-up">Our Journey</h2>
            <div class="row">
                <div class="col-md-6" data-aos="fade-right">
                    <div class="story-card">
                        <h3>The Beginning</h3>
                        <p>It all started with Jon and Sarah's vision of creating a space where family values and community connection could flourish. Their commitment to kindness and love has been the foundation upon which everything else has been built.</p>
                        <p>What began as a family's journey has grown into a vibrant community of people committed to spreading kindness and fostering genuine human connection.</p>
                    </div>
                </div>
                <div class="col-md-6" data-aos="fade-left">
                    <div class="story-card">
                        <h3>Our Growth</h3>
                        <p>As the Graves family has grown, so has our understanding of what it means to truly connect. From Trinity and Elijah's new roles as parents to the unique contributions of Mariah, Veronica, Reuel, and Ezra, each family member has enriched our collective experience.</p>
                        <p>Each new generation brings fresh perspectives while honoring the core values that make our community special.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="philosophy-section">
        <div class="container">
            <h2 class="text-center mb-5" data-aos="fade-up">Our Impact</h2>
            <div class="row">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="value-card">
                        <div class="value-icon">🌟</div>
                        <h3>Family Legacy</h3>
                        <p>From Jon and Sarah to their children and now to the next generation, our values of kindness and connection continue to grow and evolve.</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="value-card">
                        <div class="value-icon">💫</div>
                        <h3>Community Impact</h3>
                        <p>Through the diverse contributions of each family member, we've created ripples of positive change that touch countless lives.</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="value-card">
                        <div class="value-icon">✨</div>
                        <h3>Personal Growth</h3>
                        <p>Each family member's unique journey has shown us new ways to express love, kindness, and connection in our daily lives.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="story-section">
        <div class="container">
            <h2 class="text-center mb-5" data-aos="fade-up">Our Team</h2>
            <div class="row">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="story-card">
                        <h3>Family Leaders</h3>
                        <p>Jon and Sarah's vision and leadership continue to guide our community, while Trinity and Elijah bring their experience as parents to help shape our future.</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="story-card">
                        <h3>Community Builders</h3>
                        <p>Mariah and Veronica's commitment to community service and connection helps us create meaningful experiences for everyone.</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="story-card">
                        <h3>Creative Minds</h3>
                        <p>Reuel and Ezra's unique perspectives and creative approaches help us find new ways to express our values and connect with others.</p>
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

        // Add interactive elements
        document.querySelectorAll('.interactive-element').forEach(element => {
            element.addEventListener('click', function() {
                this.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    this.style.transform = 'translateY(-5px)';
                }, 200);
            });
        });
    </script>
</body>
</html> 