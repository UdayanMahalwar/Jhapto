import React from 'react';
import './HeroBanner.css';

const HeroBanner = ({ hostelName }) => (
  <section className="hero-banner" aria-label="Welcome">
    <div className="banner-content">
      <h2 className="banner-title">
        Late night cravings?<br />
        <span className="text-gradient">Delivered in minutes.</span>
      </h2>
      <p className="banner-subtitle">
        Snacks, drinks and essentials from students in {hostelName || 'your hostel'} — sorted by who's closest to you.
      </p>
    </div>

    <div className="banner-visuals" aria-hidden="true">
      <div className="floating-item item-1">🍜</div>
      <div className="floating-item item-2">🥤</div>
      <div className="floating-item item-3">🍫</div>
    </div>
  </section>
);

export default HeroBanner;
