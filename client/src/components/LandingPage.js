import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    {
      title: "Unauthorized Repo Charges",
      description: "Track repo agent activities live, avoid unauthorized actions, and maintain operational integrity.",
      icon: "🔒"
    },
    {
      title: "Recovery Agents Tracking",
      description: "Monitor repo agent activity and avoid unauthorized repossession with real-time tracking.",
      icon: "📍"
    },
    {
      title: "Data Analysis",
      description: "Generate reports and analyze repossession performance instantly with powerful analytics.",
      icon: "🔍"
    },
    {
      title: "Data Security",
      description: "Cloud-based access ensures your data is always safe and accessible with enterprise-grade security.",
      icon: "🛡️"
    }
  ];

  const stats = [
    { number: "2+", label: "Associated Banks", icon: "🏦" },
    { number: "600+", label: "Total Active Customers", icon: "👥" },
    { number: "25000+", label: "Total Active Users", icon: "📱" },
    { number: "25+", label: "States Covered", icon: "🗺️" }
  ];

  const pricingPlans = [
    {
      name: "Super Lite",
      price: "₹2500",
      period: "/ month",
      features: [
        "Web Application",
        "Full Offline Access",
        "User Management through Mobile App",
        "Customization of Fields for Repo Agent",
        "Payment Collection From Repo Agent",
        "Generate Repo Kit",
        "Removal of Duplicate Number"
      ]
    },
    {
      name: "Premium",
      price: "₹5000",
      period: "/ month",
      features: [
        "Web Application",
        "Full Offline Access",
        "User Management through Mobile App",
        "Customization of Fields for Repo Agent",
        "Location Tracking of Repo Agent",
        "Personalize App on Play Store",
        "Payment Collection From Repo Agent"
      ]
    }
  ];

  const testimonials = [
    {
      name: "HDB Financial Services",
      role: "Financial Institution",
      content: "Since May 2024, we've transformed their vehicle recovery with seamless tracking and robust data safety. Rapidrepo has revolutionized our repossession operations.",
      rating: 5,
      logo: "🏦"
    },
    {
      name: "Ambit Finvest",
      role: "NBFC Partner",
      content: "Our 2025 integration empowers Ambit Finvest with real-time tracking and streamlined repossession. The platform has significantly improved our efficiency.",
      rating: 5,
      logo: "🏢"
    },
    {
      name: "Rajesh Kumar",
      role: "Recovery Agent",
      content: "Rapidrepo has made my job so much easier. The real-time tracking and offline capabilities ensure I never miss a beat, even in remote areas.",
      rating: 5,
      logo: "👨‍💼"
    }
  ];

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: ''
  });

  const handleLoginClick = () => {
    navigate('/login');
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    // Here you can add form submission logic
    console.log('Contact form submitted:', contactForm);
    alert('Thank you for your message! We will get back to you soon.');
    setContactForm({
      name: '',
      email: '',
      company: '',
      phone: '',
      message: ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setContactForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="nav-brand">
            <h2>RAPIDREPO</h2>
          </div>
          <nav className="nav-menu">
            <a href="#home" onClick={() => scrollToSection('home')}>Home</a>
            <a href="#about" onClick={() => scrollToSection('about')}>About Us</a>
            <a href="#features" onClick={() => scrollToSection('features')}>Feature</a>
            <a href="#pricing" onClick={() => scrollToSection('pricing')}>Pricing</a>
            <a href="#testimonials" onClick={() => scrollToSection('testimonials')}>Testimonial</a>
            <a href="#contact" onClick={() => scrollToSection('contact')}>Contact</a>
          </nav>
          <button className="login-btn" onClick={handleLoginClick}>
            Login
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="hero">
        <div className="hero-background">
          <div className="particles"></div>
        </div>
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              WELCOME TO<br />
              <span className="brand-name">RAPIDREPO</span>
            </h1>
            <p className="hero-description">
              A unified platform for Banks, NBFCs, and recovery agents—transforming repossession with powerful analytics and automation.
            </p>
            <div className="app-availability">
              <p>Also Available on:</p>
              <div className="app-icons">
                <div className="app-icon android">🤖</div>
                <div className="app-icon apple">🍎</div>
              </div>
            </div>
            <button className="download-btn">Download App</button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about">
        <div className="container">
          <h2 className="section-title">ABOUT US</h2>
          <div className="about-content">
            <div className="about-text">
              <p>We simplify repossession with smart tracking and digital tools for banks, NBFCs, and recovery agencies.</p>
              <p>Rapidrepo is a solution which provide a common platform to all the banks, NBFC and their authorized repossession agencies.</p>
              <p>The vehicle repossession business is a segment in India facing many challenges, which makes the execution a bit difficult.</p>
              <p>Surprisingly, the business owners were themselves not aware that having technology into the system can make their job easy and way more effective.</p>
            </div>
            <div className="about-illustration">
              <div className="illustration-placeholder">
                <div className="illustration-figure">👨‍💼</div>
                <div className="illustration-docs">📄</div>
                <div className="illustration-laptop">💻</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="container">
          <h2 className="section-title">Why Choose <span className="brand-accent">RAPIDREPO</span></h2>
          <p className="section-subtitle">
            Here's what makes us the #1 repossession solution across leading NBFCs and financial institutions:
          </p>
          <div className="features-content">
            <div className="features-list">
              {features.map((feature, index) => (
                <div 
                  key={index}
                  className={`feature-item ${activeFeature === index ? 'active' : ''}`}
                  onClick={() => setActiveFeature(index)}
                >
                  <div className="feature-header">
                    <span className="feature-icon">{feature.icon}</span>
                    <h3 className="feature-title">{feature.title}</h3>
                    <span className="feature-arrow">
                      {activeFeature === index ? '^' : 'v'}
                    </span>
                  </div>
                  {activeFeature === index && (
                    <p className="feature-description">{feature.description}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="features-illustration">
              <div className="isometric-illustration">
                <div className="server-tower">🗄️</div>
                <div className="data-blocks">📊</div>
                <div className="network-lines">🔗</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="stats">
        <div className="container">
          <h2 className="stats-title">OUR TRUSTED PARTNERSHIPS</h2>
          <p className="stats-description">
            Rapidrepo, a cutting-edge SaaS application, revolutionizes vehicle repossession management for banks and financial institutions. Trusted by industry leaders, our platform streamlines operations, enhances efficiency, and ensures data security.
          </p>
          <p className="stats-description">
            Join leading institutions in leveraging Rapidrepo to drive efficiency and success in vehicle repossession management.
          </p>
          
          <div className="stats-grid">
            {stats.map((stat, index) => (
              <div key={index} className="stat-card">
                <div className="stat-icon">{stat.icon}</div>
                <div className="stat-number">{stat.number}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile App Section */}
      <section className="mobile-app">
        <div className="container">
          <h2 className="section-title">FEATURES</h2>
          <div className="mobile-content">
            <div className="mobile-text">
              <h3>Perfect Dashboard</h3>
            </div>
            <div className="mobile-mockup">
              <div className="phone-frame">
                <div className="phone-screen">
                  <div className="phone-header">
                    <span>☰</span>
                    <span>Home</span>
                    <span>🔔</span>
                  </div>
                  <div className="app-logo">RAPIDREPO 2.0</div>
                  <div className="search-section">
                    <input type="text" placeholder="Q Chassis Number" />
                    <input type="text" placeholder="Q 1234" />
                  </div>
                  <div className="download-info">
                    Last Downloaded DB File: 13 May 2025 - 02:04 pm
                  </div>
                  <div className="stats-cards">
                    <div className="stat-card-mobile">
                      <span>🔄</span>
                      <span>Total Records</span>
                    </div>
                    <div className="stat-card-mobile">
                      <span>📄</span>
                      <span>Personal Records</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing">
        <div className="container">
          <h2 className="section-title">USER LIMITS AND PRICING</h2>
          <div className="pricing-container">
            <div className="pricing-header">
              <div className="plan-tabs">
                <div className="plan-tab active">Super Lite</div>
                <div className="plan-tab">Premium</div>
              </div>
              <div className="pricing-display">
                <span className="price">₹2500</span>
                <span className="period">/ month</span>
              </div>
            </div>
            <div className="pricing-plans">
              {pricingPlans.map((plan, index) => (
                <div key={index} className="pricing-card">
                  <h3 className="plan-name">Rapidrepo {plan.name}</h3>
                  <ul className="plan-features">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex}>
                        <span className="checkmark">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="testimonials">
        <div className="container">
          <h2 className="section-title">WHAT OUR CLIENTS SAY</h2>
          <p className="section-subtitle">
            Trusted by leading financial institutions and recovery agencies across India
          </p>
          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="testimonial-card">
                <div className="testimonial-header">
                  <div className="testimonial-logo">{testimonial.logo}</div>
                  <div className="testimonial-info">
                    <h4 className="testimonial-name">{testimonial.name}</h4>
                    <p className="testimonial-role">{testimonial.role}</p>
                  </div>
                </div>
                <div className="testimonial-rating">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={i} className="star">⭐</span>
                  ))}
                </div>
                <p className="testimonial-content">"{testimonial.content}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact">
        <div className="container">
          <h2 className="section-title">GET IN TOUCH</h2>
          <p className="section-subtitle">
            Ready to transform your repossession operations? Contact us today!
          </p>
          <div className="contact-content">
            <div className="contact-info">
              <div className="contact-item">
                <div className="contact-icon">📧</div>
                <div className="contact-details">
                  <h4>Email</h4>
                  <p>info@rapidrepo.com</p>
                  <p>support@rapidrepo.com</p>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">📞</div>
                <div className="contact-details">
                  <h4>Phone</h4>
                  <p>+91 9997679791</p>
                  
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon">📍</div>
                <div className="contact-details">
                  <h4>Address</h4>
                  <p>00 Sec 5,</p>
                  <p>Gurgaon, Haryana 122001</p>
                </div>
              </div>
            </div>
            <div className="contact-form-container">
              <form className="contact-form" onSubmit={handleContactSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name">Full Name *</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={contactForm.name}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">Email Address *</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={contactForm.email}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your email"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="company">Company Name</label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={contactForm.company}
                      onChange={handleInputChange}
                      placeholder="Enter your company name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone">Phone Number</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={contactForm.phone}
                      onChange={handleInputChange}
                      placeholder="Enter your phone number"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="message">Message *</label>
                  <textarea
                    id="message"
                    name="message"
                    value={contactForm.message}
                    onChange={handleInputChange}
                    required
                    rows="5"
                    placeholder="Tell us about your requirements..."
                  ></textarea>
                </div>
                <button type="submit" className="submit-btn">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>RAPIDREPO</h4>
              <p>Transforming vehicle repossession with technology</p>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Pricing</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Contact</h4>
              <p>Email: info@rapidrepo.com</p>
              <p>Phone: +91 9997679791</p>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 Rapidrepo. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      <button className="scroll-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        ↑
      </button>
    </div>
  );
};

export default LandingPage;
