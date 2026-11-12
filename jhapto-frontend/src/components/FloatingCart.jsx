import React from 'react';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import './FloatingCart.css';

// Bottom cart bar on the home page. Click the summary to review the cart.
const FloatingCart = ({ count, total, placing, onCheckout, onView }) => {
  if (count === 0) return null;

  return (
    <div className="floating-cart-wrapper">
      <div className="floating-cart glass-panel">
        <button type="button" className="cart-info" onClick={onView} aria-label="Review cart"
          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
          <div className="cart-icon-wrapper">
            <ShoppingBag size={24} />
            <span className="item-count">{count}</span>
          </div>
          <div className="cart-text">
            <span className="cart-label">Items in Cart · View</span>
            <span className="cart-total">₹{total.toFixed(2)}</span>
          </div>
        </button>

        <button className="checkout-btn" onClick={onCheckout} disabled={placing} style={placing ? { opacity: 0.6, cursor: 'wait' } : undefined}>
          {placing ? 'Placing…' : <>Checkout <ArrowRight size={18} /></>}
        </button>
      </div>
    </div>
  );
};

export default FloatingCart;
