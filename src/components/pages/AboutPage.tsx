import React from 'react';

import { WebpImage } from '../common/WebpImage';
import './AboutPage.css';
import { PageLayout } from '../layout/PageLayout';
import { AppShellPageProps } from '../../types/pages/commonPageProps';

export function AboutPage({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle }: AppShellPageProps) {
  return (
    <PageLayout page="about" title="About" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <section className="hero">
        <div className="container hero-content">
          <div className="row justify-content-center">
            <div className="col-lg-9">
              <div className="welcome-message text-center">
                <h1>Our Philosophy</h1>
                <p className="lead">
                  At catn8.us, our name whispers our deepest aspiration: to catenate, to tenderly link together, not just ideas,
                  but hearts. Founded by Jon and Sarah Graves, our community is built on the foundation of family, love, and
                  connection.
                </p>
                <WebpImage className="catn8-hero-image" src="/images/homepage_family.jpg" alt="Family Connection" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="row g-4 align-items-center">
            <div className="col-lg-7">
              <h2 className="section-title section-title-sm text-start">Our Vision</h2>
              <p className="lead">
                We dream of a world where empathy is a universal language, where acts of kindness are as natural as breathing,
                and where communities are sanctuaries built upon unconditional love and unwavering mutual support.
              </p>
              <p>
                Through the example of our growing family – from Jon and Sarah to their children Trinity, Elijah, Mariah,
                Veronica, Reuel, and Ezra, and now to the next generation – we envision a future where every individual feels a
                deep sense of belonging.
              </p>
              <WebpImage className="catn8-inline-image" src="/images/homepage_kindness.jpg" alt="Community Vision" />
            </div>
            <div className="col-lg-5">
              <div className="catn8-quote catn8-glass-card">
                “Family is not an important thing. It’s everything.”
                <div className="catn8-quote-attrib">- Michael J. Fox</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Our Core Values</h2>
          <div className="row g-4">
            <div className="col-md-4">
              <div className="catn8-card p-4 h-100">
                <WebpImage className="catn8-card-image" src="/images/about_family.jpg" alt="Family First" />
                <div className="catn8-value-icon">💝</div>
                <h3 className="story-title">Family First</h3>
                <p className="story-text">
                  Following Jon and Sarah's example, we believe in putting family at the heart of everything we do, creating
                  bonds that last through generations.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="catn8-card p-4 h-100">
                <WebpImage className="catn8-card-image" src="/images/about_community.jpg" alt="Empathy in Action" />
                <div className="catn8-value-icon">🤝</div>
                <h3 className="story-title">Empathy in Action</h3>
                <p className="story-text">
                  From Trinity and Elijah's parenting to Mariah and Veronica's community work, we see how empathy transforms
                  lives and builds stronger connections.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="catn8-card p-4 h-100">
                <WebpImage className="catn8-card-image" src="/images/about_growth.jpg" alt="Gentle Growth" />
                <div className="catn8-value-icon">🌱</div>
                <h3 className="story-title">Gentle Growth</h3>
                <p className="story-text">
                  Through Reuel and Ezra's unique perspectives, we've learned that growth comes in many forms, each beautiful
                  in its own way.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Our Journey</h2>
          <div className="row g-4">
            <div className="col-md-6">
              <div className="catn8-card p-4 h-100">
                <WebpImage className="catn8-card-image" src="/images/homepage_family.jpg" alt="The Beginning" />
                <h3 className="story-title">The Beginning</h3>
                <p className="story-text">
                  It all started with Jon and Sarah's vision of creating a space where family values and community connection
                  could flourish. Their commitment to kindness and love has been the foundation upon which everything else has
                  been built.
                </p>
              </div>
            </div>
            <div className="col-md-6">
              <div className="catn8-card p-4 h-100">
                <WebpImage className="catn8-card-image" src="/images/homepage_kindness.jpg" alt="Our Growth" />
                <h3 className="story-title">Our Growth</h3>
                <p className="story-text">
                  As the Graves family has grown, so has our understanding of what it means to truly connect. From Trinity and
                  Elijah's new roles as parents to the unique contributions of Mariah, Veronica, Reuel, and Ezra, each family
                  member has enriched our collective experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Our Team</h2>
          <div className="row g-4">
            <div className="col-md-4">
              <div className="catn8-card p-4 h-100">
                <WebpImage className="catn8-card-image" src="/images/homepage_friends.jpg" alt="Family Leaders" />
                <h3 className="story-title">Family Leaders</h3>
                <p className="story-text">
                  Jon and Sarah's vision and leadership continue to guide our community, while Trinity and Elijah bring their
                  experience as parents to help shape our future.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="catn8-card p-4 h-100">
                <WebpImage className="catn8-card-image" src="/images/about_community.jpg" alt="Community Builders" />
                <h3 className="story-title">Community Builders</h3>
                <p className="story-text">
                  Mariah and Veronica's commitment to community service and connection helps us create meaningful experiences
                  for everyone.
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="catn8-card p-4 h-100">
                <WebpImage className="catn8-card-image" src="/images/about_growth.jpg" alt="Creative Minds" />
                <h3 className="story-title">Creative Minds</h3>
                <p className="story-text">
                  Reuel and Ezra's unique perspectives and creative approaches help us find new ways to express our values and
                  connect with others.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
