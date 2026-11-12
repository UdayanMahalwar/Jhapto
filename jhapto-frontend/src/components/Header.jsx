import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, ShoppingBag, User } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { useCart } from '../contexts/CartContext';
import './Header.css';

const Header = ({ user, onLogout, onOrdersClick, onSellerClick, searchQuery, onSearchChange }) => {
  const navigate = useNavigate();
  const cart = useCart();
  const cartCount = cart ? cart.count : 0;

  return (
    <header className="header glass-panel">
      <div className="header-container">
        <div className="logo-section">
          <h1 className="logo text-gradient" onClick={() => navigate('/')} style={{cursor: 'pointer'}}>JHAPTO</h1>
        </div>
        
        <div className="location-section">
          <div className="location-badge">
            <MapPin size={16} className="location-icon" />
            <div className="location-text">
              <span className="location-title">Delivery to</span>
              <span className="location-value">{user ? `${user.hostel_name || `Hostel ${user.hostel_id}`}, F-${user.floor_number ?? user.floor_id}` : 'Login to view'}</span>
            </div>
          </div>
        </div>
        
        <div className="search-section">
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search for snacks, drinks, essentials..." 
              className="search-input"
              value={searchQuery || ''}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            />
          </div>
        </div>
        
        <div className="actions-section">
          {user && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span className="header-greeting" style={{ fontSize: '0.9rem', fontWeight: 600 }}>Hi, {user.name.split(' ')[0]}</span>
              <NotificationBell />
              <button className="icon-btn" onClick={onOrdersClick} title="My Orders" style={{ fontSize: '0.8rem', width: 'auto', padding: '0 10px', borderRadius: '12px' }}>Orders</button>
              <button className="icon-btn" onClick={onSellerClick} title="Seller Dashboard" style={{ fontSize: '0.8rem', width: 'auto', padding: '0 10px', borderRadius: '12px' }}>Sell</button>
              <button className="icon-btn" onClick={() => navigate('/profile')} title="My Profile" aria-label="My Profile">
                <User size={20} />
              </button>
              <button className="icon-btn" onClick={onLogout} title="Logout" style={{ fontSize: '0.8rem', width: 'auto', padding: '0 10px', borderRadius: '12px', color: 'var(--secondary-color)' }}>Logout</button>
            </div>
          )}
          {!user && (
            <button className="icon-btn" onClick={() => navigate('/login')} aria-label="Log in">
              <User size={22} />
            </button>
          )}
          <button className="icon-btn cart-btn" onClick={() => navigate('/cart')} title="Cart" aria-label={`Cart${cartCount ? ` (${cartCount} items)` : ''}`}>
            <ShoppingBag size={22} />
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
