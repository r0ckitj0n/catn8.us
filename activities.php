<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Activities - catn8.us</title>
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

        .activities-section {
            padding: 5rem 0;
            background: var(--light-color);
        }

        .activity-card {
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
            height: auto;
            min-height: 429px;
            display: flex;
            flex-direction: column;
        }

        .activity-content {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .activity-image {
            width: 100%;
            height: 214px;
            object-fit: cover;
            border-radius: 15px;
            margin-bottom: 1rem;
            border: 3px solid var(--accent-color);
        }

        .activity-title {
            font-size: 2rem;
            color: var(--primary-color);
            margin-bottom: 1rem;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .activity-card h3 {
            font-size: 1.2rem;
            margin-bottom: 0.5rem;
            color: #5DBCB3;
            font-weight: bold;
        }

        .activity-card p {
            font-size: 0.9rem;
            color: var(--dark-color);
            margin-bottom: 0.5rem;
            flex-grow: 1;
            overflow: visible;
            display: block;
        }

        .activity-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 0.5rem;
            justify-content: center;
        }

        .activity-tag {
            background: var(--accent-color);
            color: var(--primary-color);
            padding: 0.25rem 0.75rem;
            border-radius: 15px;
            font-size: 0.8rem;
        }

        .activity-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            border-color: var(--accent-color);
        }

        .activity-image.error {
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.2rem;
            text-align: center;
            padding: 1rem;
        }

        .activity-navigation {
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

        .activity-navigation .nav-item {
            margin: 15px 0;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1.2rem;
            padding: 10px;
            border-radius: 15px;
            text-align: center;
        }

        .activity-navigation .nav-item:hover {
            background: var(--accent-color);
            transform: scale(1.1);
        }

        .activity-navigation .nav-item.active {
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
        }

        .platform {
            background: var(--accent-color);
            color: var(--primary-color);
            padding: 0.25rem 0.75rem;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: bold;
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
                        <a class="nav-link" href="stories.php">Stories</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="games.php">Games</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link active" href="activities.php">Activities</a>
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

    <div class="activity-navigation" data-aos="fade-left">
        <div class="d-flex flex-column gap-2">
            <div class="nav-item active" data-filter="all">All Activities</div>
            <div class="nav-item" data-filter="3-7">Ages 3-7</div>
            <div class="nav-item" data-filter="8-12">Ages 8-12</div>
            <div class="nav-item" data-filter="13">Ages 13+</div>
            <div class="nav-item" data-filter="learning">Learning</div>
            <div class="nav-item" data-filter="reading">Reading</div>
            <div class="nav-item" data-filter="coloring">Coloring</div>
            <div class="nav-item" data-filter="art">Art</div>
            <div class="nav-item" data-filter="games">Games</div>
            <div class="nav-item" data-filter="puzzles">Puzzles</div>
            <div class="nav-item" data-filter="crafts">Crafts</div>
            <div class="nav-item" data-filter="education">Education</div>
            <div class="nav-item" data-filter="music">Music</div>
        </div>
    </div>

    <section class="activities-section">
        <div class="container">
            <div class="row">
                <!-- Ages 3-7 -->
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="activity-card" data-category="learning reading" data-age="3-7" onclick="window.open('https://www.starfall.com', '_blank')">
                        <div class="activity-content">
                            <span class="age-badge">Ages 3-7</span>
                            <img src="images/starfall-reading-fun.jpg" alt="Starfall" class="activity-image">
                            <h3>Starfall</h3>
                            <p>Learn to read with fun interactive stories and games! Perfect for beginning readers.</p>
                        </div>
                        <div class="activity-tags">
                            <span class="activity-tag">Learning</span>
                            <span class="activity-tag">Reading</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="activity-card" data-category="coloring art" data-age="3-7" onclick="window.open('https://www.coloring.ws', '_blank')">
                        <div class="activity-content">
                            <span class="age-badge">Ages 3-7</span>
                            <img src="images/coloring-ws-art-adventure.jpg" alt="Coloring.ws" class="activity-image">
                            <h3>Coloring.ws</h3>
                            <p>Simple coloring pages perfect for little artists! From animals to shapes.</p>
                        </div>
                        <div class="activity-tags">
                            <span class="activity-tag">Coloring</span>
                            <span class="activity-tag">Art</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="activity-card" data-category="games learning" data-age="3-7" onclick="window.open('https://pbskids.org/games', '_blank')">
                        <div class="activity-content">
                            <span class="age-badge">Ages 3-7</span>
                            <img src="images/pbs-kids-educational-play.jpg" alt="PBS Kids Games" class="activity-image">
                            <h3>PBS Kids Games</h3>
                            <p>Fun educational games featuring favorite PBS Kids characters!</p>
                        </div>
                        <div class="activity-tags">
                            <span class="activity-tag">Games</span>
                            <span class="activity-tag">Learning</span>
                        </div>
                    </div>
                </div>

                <!-- Ages 8-12 -->
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="activity-card" data-category="coloring art" data-age="8-12" onclick="window.open('https://coloritbynumbers.com', '_blank')">
                        <div class="activity-content">
                            <span class="age-badge">Ages 8-12</span>
                            <img src="images/color-by-numbers-art.jpg" alt="Color It By Numbers" class="activity-image">
                            <h3>Color It By Numbers</h3>
                            <p>Create beautiful artwork by following the numbers! A fun way to learn colors and numbers.</p>
                        </div>
                        <div class="activity-tags">
                            <span class="activity-tag">Coloring</span>
                            <span class="activity-tag">Art</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="activity-card" data-category="puzzles learning" data-age="8-12" onclick="window.open('https://puzzlemaker.discoveryeducation.com', '_blank')">
                        <div class="activity-content">
                            <span class="age-badge">Ages 8-12</span>
                            <img src="images/puzzle-maker-learning.jpg" alt="Puzzle Maker" class="activity-image">
                            <h3>Puzzle Maker</h3>
                            <p>Create your own word searches and crosswords! Great for learning new words.</p>
                        </div>
                        <div class="activity-tags">
                            <span class="activity-tag">Puzzles</span>
                            <span class="activity-tag">Learning</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="activity-card" data-category="crafts art" data-age="8-12" onclick="window.open('https://www.crayola.com/crafts', '_blank')">
                        <div class="activity-content">
                            <span class="age-badge">Ages 8-12</span>
                            <img src="images/crayola-crafts-creative.jpg" alt="Crayola Crafts" class="activity-image">
                            <h3>Crayola Crafts</h3>
                            <p>Fun craft projects for kids! From paper crafts to DIY decorations.</p>
                        </div>
                        <div class="activity-tags">
                            <span class="activity-tag">Crafts</span>
                            <span class="activity-tag">Art</span>
                        </div>
                    </div>
                </div>

                <!-- Ages 13+ -->
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100">
                    <div class="activity-card" data-category="learning education" data-age="13" onclick="window.open('https://www.khanacademy.org/kids', '_blank')">
                        <div class="activity-content">
                            <span class="age-badge">Ages 13+</span>
                            <img src="images/khan-academy-interactive.jpg" alt="Khan Academy Kids" class="activity-image">
                            <h3>Khan Academy Kids</h3>
                            <p>Interactive learning activities covering math, reading, and more!</p>
                        </div>
                        <div class="activity-tags">
                            <span class="activity-tag">Learning</span>
                            <span class="activity-tag">Education</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200">
                    <div class="activity-card" data-category="music learning" data-age="13" onclick="window.open('https://www.musictheory.net', '_blank')">
                        <div class="activity-content">
                            <span class="age-badge">Ages 13+</span>
                            <img src="images/music-theory-learning.jpg" alt="Music Theory" class="activity-image">
                            <h3>Music Theory</h3>
                            <p>Learn about music in a fun way! Practice reading notes and learn about rhythm.</p>
                        </div>
                        <div class="activity-tags">
                            <span class="activity-tag">Music</span>
                            <span class="activity-tag">Learning</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300">
                    <div class="activity-card" data-category="learning games" data-age="13" onclick="window.open('https://www.abcya.com', '_blank')">
                        <div class="activity-content">
                            <span class="age-badge">Ages 13+</span>
                            <img src="images/abcya-educational-games.jpg" alt="ABCya" class="activity-image">
                            <h3>ABCya</h3>
                            <p>Educational games and activities! Learn math, reading, and more while having fun.</p>
                        </div>
                        <div class="activity-tags">
                            <span class="activity-tag">Learning</span>
                            <span class="activity-tag">Games</span>
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

        // Store all original activity cards to use for filtering
        let allActivityCards = [];
        
        // Handle image loading errors
        document.querySelectorAll('.activity-image, .modal-image').forEach(img => {
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
                document.querySelectorAll('.activity-card.active').forEach(card => {
                    card.classList.remove('active');
                });
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            });
        });

        // Handle activity card clicks
        document.querySelectorAll('.activity-card').forEach(card => {
            card.addEventListener('click', function() {
                const modalId = this.getAttribute('data-bs-target');
                const modal = document.querySelector(modalId);
                if (modal) {
                    const modalInstance = bootstrap.Modal.getInstance(modal) || new bootstrap.Modal(modal);
                    modalInstance.show();
                }
            });
        });

        // Function to filter and display activities
        function filterActivities(filter) {
            console.log('Filtering activities for:', filter);
            
            // Get the container to add activities to
            const container = document.querySelector('.activities-section .container');
            
            // Get all activity cards if we haven't stored them yet
            if (allActivityCards.length === 0) {
                allActivityCards = Array.from(document.querySelectorAll('.activity-card')).map(card => {
                    const clone = card.cloneNode(true);
                    return clone;
                });
            }
            
            // Clear existing rows
            const rows = document.querySelectorAll('.activities-section .row');
            rows.forEach(row => row.remove());

            // Create new rows
            let currentRow = document.createElement('div');
            currentRow.className = 'row';
            container.appendChild(currentRow);
            let colCount = 0;

            // Filter and display activities
            const filteredCards = allActivityCards.filter(card => {
                const cardCategory = card.getAttribute('data-category');
                const cardAge = card.getAttribute('data-age');
                return filter === 'all' || cardCategory === filter || cardAge === filter;
            });
            
            console.log('Filtered cards:', filteredCards.length);

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
            
            // Show a message if no activities match the filter
            if (filteredCards.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'col-12 text-center mt-5';
                emptyMessage.innerHTML = '<h3>No activities found for this category.</h3><p>Please select another category.</p>';
                currentRow.appendChild(emptyMessage);
            }
        }

        // Handle category filtering
        document.querySelectorAll('.activity-navigation .nav-item').forEach(item => {
            item.addEventListener('click', function() {
                const filter = this.getAttribute('data-filter');
                console.log('Filter clicked:', filter);
                
                // Update active state in navigation
                document.querySelectorAll('.activity-navigation .nav-item').forEach(navItem => {
                    navItem.classList.remove('active');
                });
                this.classList.add('active');
                
                // Filter activities
                filterActivities(filter);
            });
        });

        // Store original activities and initialize display
        document.addEventListener('DOMContentLoaded', function() {
            // Get original activity cards
            allActivityCards = Array.from(document.querySelectorAll('.activity-card')).map(card => card.cloneNode(true));
            console.log('Total activity cards:', allActivityCards.length);
            // Initial display
            filterActivities('all');
        });
    </script>
</body>
</html> 