import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, Menu, X } from "lucide-react";
import "./landing-page.css";

const navigationItems = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const galleryImages = [
  {
    src: "/piat-landing/piat-students.jpg",
    alt: "PIAT students gathered in a classroom",
    className: "landing-gallery__image landing-gallery__image--tall",
  },
  {
    src: "/piat-landing/piat-commencement.jpg",
    alt: "PIAT community at a commencement celebration",
    className: "landing-gallery__image",
  },
  {
    src: "/piat-landing/piat-learning.jpg",
    alt: "Students taking part in a classroom activity",
    className: "landing-gallery__image",
  },
  {
    src: "/piat-landing/piat-community.jpg",
    alt: "PIAT community celebrating together",
    className: "landing-gallery__image landing-gallery__image--wide",
  },
];

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-header__inner">
          <a
            href="#home"
            className="landing-brand"
            aria-label="PIAT home"
            onClick={() => setIsMenuOpen(false)}
          >
            <img src="/piat-logo.svg" alt="" className="landing-brand__logo" />
            <span className="landing-brand__text">
              <span className="landing-brand__name">PIAT</span>
              <span className="landing-brand__subtitle">
                Philtech Institute of Arts and Technology Inc.
              </span>
            </span>
          </a>

          <button
            type="button"
            className="landing-menu-toggle"
            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMenuOpen}
            aria-controls="landing-navigation"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>

          <nav
            id="landing-navigation"
            className={`landing-navigation${isMenuOpen ? " landing-navigation--open" : ""}`}
            aria-label="Main navigation"
          >
            {navigationItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="landing-navigation__link"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/login"
              className="landing-navigation__login"
              onClick={() => setIsMenuOpen(false)}
            >
              Login <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero" id="home" aria-labelledby="landing-title">
          <img
            src="/piat-landing/piat-graduation.jpg"
            alt=""
            className="landing-hero__image"
            fetchPriority="high"
            decoding="async"
          />
          <div className="landing-hero__overlay" />
          <div className="landing-hero__content">
            <p className="landing-eyebrow landing-eyebrow--light">
              Philtech Institute of Arts and Technology Inc.
            </p>
            <h1 id="landing-title">
              Welcome
              <br />
              to <span>PIAT</span>
            </h1>
            <p className="landing-hero__intro">
              A place to learn, grow, and be part of a community shaped by arts and technology.
            </p>
            <div className="landing-hero__actions">
              <Link to="/login" className="landing-button landing-button--light">
                Enter the portal <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <a href="#about" className="landing-hero__discover">
                Discover PIAT <ArrowDown aria-hidden="true" size={16} />
              </a>
            </div>
          </div>
          <p className="landing-hero__caption">A community learning and celebrating together</p>
        </section>

        <section className="landing-about" id="about" aria-labelledby="about-title">
          <div className="landing-about__inner">
            <div className="landing-about__copy">
              <p className="landing-eyebrow">A closer look</p>
              <h2 id="about-title">
                Arts and technology,
                <br />
                <span>together at PIAT.</span>
              </h2>
              <p>
                PHILTECH INSTITUTE OF ARTS AND TECHNOLOGY INC. (PIAT) is an educational institution
                with a community of students and educators. This page is a welcome to the people,
                learning, and shared moments that make up the PIAT community.
              </p>
              <a href="#contact" className="landing-text-link">
                Get in touch <ArrowRight aria-hidden="true" size={17} />
              </a>
            </div>
            <figure className="landing-about__photo">
              <img
                src="/piat-landing/piat-classroom.jpg"
                alt="Students and educators together in a PIAT classroom"
                loading="lazy"
                decoding="async"
              />
              <figcaption>Learning is a shared experience.</figcaption>
            </figure>
          </div>
        </section>

        <section className="landing-gallery" aria-labelledby="gallery-title">
          <div className="landing-gallery__heading">
            <div>
              <p className="landing-eyebrow">Life at PIAT</p>
              <h2 id="gallery-title">Moments from our community</h2>
            </div>
            <p>Real moments from the classrooms and celebrations shared by PIAT.</p>
          </div>
          <div className="landing-gallery__grid">
            {galleryImages.map((image) => (
              <figure className={image.className} key={image.src}>
                <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
              </figure>
            ))}
          </div>
        </section>

        <section className="landing-contact" id="contact" aria-labelledby="contact-title">
          <div className="landing-contact__inner">
            <div>
              <p className="landing-eyebrow landing-eyebrow--light">Contact</p>
              <h2 id="contact-title">We’d be glad to hear from you.</h2>
              <p>
                For inquiries, please refer to PIAT’s official communication channels. No verified
                email address, phone number, or street address is currently listed on this page.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__main">
          <a href="#home" className="landing-footer__identity">
            <img src="/piat-logo.svg" alt="" loading="lazy" />
            <span>PHILTECH INSTITUTE OF ARTS AND TECHNOLOGY INC.</span>
          </a>
        </div>
        <div className="landing-footer__bottom">
          <span>© {new Date().getFullYear()} PHILTECH INSTITUTE OF ARTS AND TECHNOLOGY INC.</span>
          <a href="#home">Back to top ↑</a>
        </div>
      </footer>
    </div>
  );
}
