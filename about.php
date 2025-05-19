<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About - catn8.us</title>
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

        .nav-link.active {
            background: rgba(255, 255, 255, 0.2);
            font-weight: 600;
        }

        .navbar-toggler {
            border: none;
            padding: 0.5rem;
        }

        .navbar-toggler:focus {
            box-shadow: none;
        }

        .navbar-toggler-icon {
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba(255, 255, 255, 1)' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
        }

        .hero {
            background: linear-gradient(135deg, var(--fun-purple), var(--fun-green));
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

        .section {
            padding: 5rem 0;
            color: white;
        }

        .section-alt {
            background: linear-gradient(135deg, var(--fun-orange), var(--fun-purple));
        }

        .section-main {
            background: linear-gradient(135deg, var(--fun-green), var(--secondary-color));
        }

        .card {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 20px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            border: 2px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            height: 100%;
        }

        .card:hover {
            transform: translateY(-5px);
            background: rgba(255, 255, 255, 0.25);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }

        .card img {
            width: 100%;
            height: 250px;
            object-fit: cover;
            border-radius: 15px;
            margin-bottom: 1rem;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }

        .card h3 {
            color: white;
            font-size: 1.5rem;
            margin-bottom: 1rem;
            font-weight: 600;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .card p {
            color: white;
            font-size: 1.1rem;
            line-height: 1.6;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        .value-icon {
            font-size: 3rem;
            margin-bottom: 1.5rem;
            color: white;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .quote {
            font-style: italic;
            font-size: 1.2rem;
            color: white;
            margin: 2rem 0;
            text-align: center;
            background: rgba(255, 255, 255, 0.15);
            padding: 2rem;
            border-radius: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.2);
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        .interactive-element {
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .interactive-element:hover {
            transform: scale(1.05);
        }

        h1, h2 {
            color: white;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        p {
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        @keyframes float {
            0% { transform: translateY(0); }
            100% { transform: translateY(-100%); }
        }
    </style>
</head>
<body>
    <nav class="navbar navbar-expand-lg fixed-top">
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
                        <a class="nav-link active" href="about.php">About</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="stories.php">Stories</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="games.php">Games</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="arcade.php">Arcade</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="activities.php">Activities</a>
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
                    <img src="images/homepage_family.jpg" alt="Family Connection" class="img-fluid rounded mt-4" style="max-height: 400px; width: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                </div>
            </div>
        </div>
    </section>

    <section class="section section-alt">
        <div class="container">
            <div class="row">
                <div class="col-md-6" data-aos="fade-right">
                    <h2>Our Vision</h2>
                    <p>We dream of a world where empathy is a universal language, where acts of kindness are as natural as breathing, and where communities are sanctuaries built upon unconditional love and unwavering mutual support.</p>
                    <p>Through the example of our growing family – from Jon and Sarah to their children Trinity, Elijah, Mariah, Veronica, Reuel, and Ezra, and now to the next generation – we envision a future where every individual feels a deep sense of belonging.</p>
                    <img src="images/homepage_kindness.jpg" alt="Community Vision" class="img-fluid rounded mt-4" style="max-height: 300px; width: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
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

    <section class="section section-main">
        <div class="container">
            <h2 class="text-center mb-5" data-aos="fade-up">Our Core Values</h2>
            <div class="row">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="card interactive-element">
                        <img src="images/about_family.jpg" alt="Family First" class="img-fluid rounded">
                        <div class="value-icon">💝</div>
                        <h3>Family First</h3>
                        <p>Following Jon and Sarah's example, we believe in putting family at the heart of everything we do, creating bonds that last through generations.</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="card interactive-element">
                        <img src="images/about_community.jpg" alt="Empathy in Action" class="img-fluid rounded">
                        <div class="value-icon">🤝</div>
                        <h3>Empathy in Action</h3>
                        <p>From Trinity and Elijah's parenting to Mariah and Veronica's community work, we see how empathy transforms lives and builds stronger connections.</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="card interactive-element">
                        <img src="images/about_growth.jpg" alt="Gentle Growth" class="img-fluid rounded">
                        <div class="value-icon">🌱</div>
                        <h3>Gentle Growth</h3>
                        <p>Through Reuel and Ezra's unique perspectives, we've learned that growth comes in many forms, each beautiful in its own way.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section section-alt">
        <div class="container">
            <h2 class="text-center mb-5" data-aos="fade-up">Our Journey</h2>
            <div class="row">
                <div class="col-md-6" data-aos="fade-right">
                    <div class="card">
                        <img src="images/homepage_family.jpg" alt="The Beginning" class="img-fluid rounded">
                        <h3>The Beginning</h3>
                        <p>It all started with Jon and Sarah's vision of creating a space where family values and community connection could flourish. Their commitment to kindness and love has been the foundation upon which everything else has been built.</p>
                    </div>
                </div>
                <div class="col-md-6" data-aos="fade-left">
                    <div class="card">
                        <img src="images/homepage_kindness.jpg" alt="Our Growth" class="img-fluid rounded">
                        <h3>Our Growth</h3>
                        <p>As the Graves family has grown, so has our understanding of what it means to truly connect. From Trinity and Elijah's new roles as parents to the unique contributions of Mariah, Veronica, Reuel, and Ezra, each family member has enriched our collective experience.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="section section-main">
        <div class="container">
            <h2 class="text-center mb-5" data-aos="fade-up">Our Team</h2>
            <div class="row">
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="card">
                        <img src="images/homepage_friends.jpg" alt="Family Leaders" class="img-fluid rounded">
                        <h3>Family Leaders</h3>
                        <p>Jon and Sarah's vision and leadership continue to guide our community, while Trinity and Elijah bring their experience as parents to help shape our future.</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="card">
                        <img src="images/about_community.jpg" alt="Community Builders" class="img-fluid rounded">
                        <h3>Community Builders</h3>
                        <p>Mariah and Veronica's commitment to community service and connection helps us create meaningful experiences for everyone.</p>
                    </div>
                </div>
                <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="card">
                        <img src="images/about_growth.jpg" alt="Creative Minds" class="img-fluid rounded">
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