import React from 'react';

import { WebpImage } from '../common/WebpImage';
import './HomePage.css';
import { PageLayout } from '../layout/PageLayout';

interface HomePageProps {
  viewer: any;
  onLoginClick: () => void;
  onLogout: () => void;
  onAccountClick: () => void;
  mysteryTitle?: string;
}

export function HomePage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle }: HomePageProps) {
  const cards = [
    { href: 'stories.php', title: 'Stories', text: 'Read our fun adventures!', image: '/images/homepage_friends.jpg' },
    { href: 'games.php', title: 'Games', text: 'Play and learn together!', image: '/images/homepage_growth.jpg' },
    { href: 'activities.php', title: 'Activities', text: 'Fun things to do!', image: '/images/homepage_kindness.jpg' },
  ];

  return (
    <PageLayout page="home" title="catn8.us" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="hero">
        <div className="container hero-content">
          <div className="row align-items-center g-4">
            <div className="col-lg-6">
              <div className="welcome-message">
                <h1>Welcome to catn8.us!</h1>
                <p className="lead">Where Fun Meets Family!</p>
                <p>
                  Welcome to our magical corner of the internet! This is a special place where families come together to share
                  stories, play games, and create wonderful memories.
                </p>

                <div className="catn8-dictionary-entry mt-3">
                  <div className="row align-items-center g-3">
                    <div className="col-md-8">
                      <h3 className="catn8-dictionary-word">catenate</h3>
                      <div className="catn8-dictionary-pron">/ˈkatnˌāt/</div>
                      <div className="catn8-dictionary-pos">
                        <strong>verb</strong> (used with object)
                      </div>
                      <div>1. to link together; form into a chain</div>
                    </div>
                    <div className="col-md-4 text-center">
                      <WebpImage className="catn8-dictionary-logo" src="/images/catn8_logo.svg" alt="catn8.us Logo" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-6 text-center">
              <WebpImage className="catn8-hero-image" src="/images/catfamily.jpeg" alt="The Graves Family" />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="quick-access">
            {cards.map((c) => (
              <a className="quick-access-btn" href={c.href} key={c.href}>
                <WebpImage className="catn8-quick-access-image" src={c.image} alt={c.title} />
                <div className="quick-access-title">{c.title}</div>
                <div>{c.text}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">What Makes Us Special</h2>
          <div className="featured-grid">
            <div className="featured-card">
              <WebpImage className="catn8-featured-image" src="/images/homepage_friends.jpg" alt="Making Friends" />
              <div className="featured-card-content">
                <h3>Making Friends</h3>
                <p>
                  We love making new friends and being kind to everyone! Here, we learn how to be good friends by sharing,
                  listening, and helping each other.
                </p>
              </div>
            </div>
            <div className="featured-card">
              <WebpImage className="catn8-featured-image" src="/images/homepage_kindness.jpg" alt="Spreading Joy" />
              <div className="featured-card-content">
                <h3>Spreading Joy</h3>
                <p>
                  Did you know that being kind is like spreading magic? Every time we do something nice, it makes someone else
                  happy, and that happiness grows and grows!
                </p>
              </div>
            </div>
            <div className="featured-card">
              <WebpImage className="catn8-featured-image" src="/images/homepage_growth.jpg" alt="Growing Together" />
              <div className="featured-card-content">
                <h3>Growing Together</h3>
                <p>
                  Just like plants need water and sunshine to grow, we need love and friendship to grow into our best selves!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-6">
              <h2 className="section-title section-title-sm text-start">Ready for Adventure?</h2>
              <p className="lead">
                Every day is a new adventure waiting to happen! Whether we're exploring new stories, playing exciting games, or
                learning something new, we make sure it's always fun and full of surprises.
              </p>
              <p>Join us on this amazing journey where every moment is a chance to discover something wonderful!</p>
            </div>
            <div className="col-lg-6 text-center">
              <WebpImage className="catn8-hero-image" src="/images/homepage_adventure.jpg" alt="Adventure" />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <div className="welcome-message text-center">
                <h2 className="section-title mb-3">Join Our Family!</h2>
                <p className="lead">
                  Welcome to our special family circle! We're like a big, friendly tree where everyone can find a branch to sit
                  on.
                </p>
                <p>
                  Here at catn8.us, we believe that every family is unique and special. We're not just a website - we're a
                  community of friends who love to learn, play, and grow together. Our family tree keeps growing with new
                  friends who bring their own special magic to our circle.
                </p>
                <p>
                  What makes our family special? It's the way we care for each other, share our stories, and create memories
                  that last a lifetime. Whether you're reading our fun stories, playing our exciting games, or trying out our
                  creative activities, you're part of something wonderful.
                </p>
                <p>
                  New friends join us through invitations from our current members, making sure our tree grows with love and
                  care. It's like having a secret handshake that only special friends know about!
                </p>
                <p>
                  So, are you ready to be part of our growing family? We can't wait to share adventures, create memories, and
                  make new friends together. Remember, in our family, everyone is welcome, everyone is special, and everyone
                  belongs!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
