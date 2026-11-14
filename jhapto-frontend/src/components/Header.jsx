import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, MapPin, ShoppingBag, LogOut, X } from 'lucide-react';
import { NAV } from '../utils/navigation';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import CountBadge from './CountBadge';
import { useCart } from '../contexts/cart';
import './Header.css';

const initials = (name = '') => name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();


const Header = ({ user, onLogout, searchQuery, onSearchChange }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const cart = useCart();
  const cartCount = cart ? cart.count : 0;
  const [mobileSearch, setMobileSearch] = useState(false);
  const hasSearch = typeof onSearchChange === 'function';
  const location = user ? `${user.hostel_name || `Hostel ${user.hostel_id}`}, Floor ${user.floor_number ?? user.floor_id}` : '';

  return (
    <>
      <header className="header">
        <div className="header-container">
          {/* Mobile: search toggle on the left (home page only) */}
          <div className="header-mobile-left">
            {hasSearch ? (
              <button className="icon-btn" onClick={() => setMobileSearch(v => !v)} aria-label={mobileSearch ? 'Close search' : 'Search'} aria-expanded={mobileSearch}>
                {mobileSearch ? <X size={20} /> : <Search size={20} />}
              </button>
            ) : (
              <span className="logo-mark" onClick={() => navigate('/')} role="link" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate('/')}>j<span>.</span></span>
            )}
          </div>

          <button className="logo" onClick={() => navigate('/')} aria-label="Jhapto home">
            jhapto<span className="logo-dot">.</span>
          </button>

          {user && (
            <div className="location-badge" title="Delivery location">
              <span className="location-title"><MapPin size={12} /> Deliver to</span>
              <span className="location-value">{location}</span>
            </div>
          )}

          {hasSearch && (
            <div className="search-section">
              <label className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                  type="search"
                  placeholder="Search snacks, drinks, essentials…"
                  className="search-input"
                  value={searchQuery || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  aria-label="Search listings"
                />
              </label>
            </div>
          )}

          <nav className="header-nav" aria-label="Main">
            {user && NAV.map(item => {
              const active = item.match(pathname);
              return (
                <button key={item.to} className={`nav-link ${active ? 'active' : ''}`} onClick={() => navigate(item.to)} aria-current={active ? 'page' : undefined}>
                  {active && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <span className="nav-label">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="actions-section">
            <ThemeToggle />
            {user && <NotificationBell />}
            <button className={`icon-btn cart-btn hide-mobile ${pathname === '/cart' ? 'active' : ''}`} onClick={() => navigate('/cart')} title="Cart" aria-label={`Cart${cartCount ? ` (${cartCount} items)` : ''}`}>
              <ShoppingBag size={20} />
              <CountBadge count={cartCount} />
            </button>
            {user ? (
              <>
                <button className={`avatar-btn ${pathname === '/profile' ? 'active' : ''}`} onClick={() => navigate('/profile')} title={`${user.name} — profile`} aria-label="My profile">
                  {initials(user.name)}
                </button>
                <button className="icon-btn hide-mobile" onClick={onLogout} title="Log out" aria-label="Log out">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>Log in</button>
            )}
          </div>
        </div>

        {/* Mobile search drops down under the header */}
        <AnimatePresence initial={false}>
          {hasSearch && mobileSearch && (
            <motion.div
              className="mobile-search"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <label className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                  type="search"
                  autoFocus
                  placeholder="Search snacks, drinks, essentials…"
                  className="search-input"
                  value={searchQuery || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  aria-label="Search listings"
                />
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

    </>
  );
};

export default Header;
