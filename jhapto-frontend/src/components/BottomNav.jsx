import React, { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, User } from 'lucide-react';
import CountBadge from './CountBadge';
import { AuthContext } from '../contexts/auth';
import { useCart } from '../contexts/cart';
import './Header.css';

import { NAV } from '../utils/navigation';

const TABS = [
  ...NAV,
  { to: '/cart', label: 'Cart', icon: ShoppingBag, match: (p) => p === '/cart' },
  { to: '/profile', label: 'Profile', icon: User, match: (p) => p === '/profile' || p.startsWith('/reports') },
];

// Mobile bottom tab bar. Rendered once by App, outside the page transition, so it
// stays put while pages change and the active pill slides between tabs.
const BottomNav = () => {
  const { user } = useContext(AuthContext);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const cart = useCart();
  if (!user || pathname === '/login' || pathname.startsWith('/admin')) return null;
  const cartCount = cart ? cart.count : 0;

  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <button key={item.to} className={`bottom-nav-item ${active ? 'active' : ''}`}
            onClick={() => { if (!active) navigate(item.to); }} aria-current={active ? 'page' : undefined}>
            {active && <motion.span layoutId="bottom-pill" className="bottom-pill" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
            <motion.span className="bottom-nav-icon" animate={{ y: active ? -1 : 0, scale: active ? 1.08 : 1 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
              <Icon size={21} />
              {item.to === '/cart' && cartCount > 0 && <CountBadge count={cartCount} className="cart-badge small" />}
            </motion.span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
