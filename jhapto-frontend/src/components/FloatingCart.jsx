import React, { useEffect } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import './FloatingCart.css';

// Number that counts smoothly to its new value
const AnimatedAmount = ({ value }) => {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => `₹${v.toFixed(2)}`);
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.45, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span className="cart-total">{text}</motion.span>;
};

// Bottom cart bar on the home page. Click the summary to review the cart.
const FloatingCart = ({ count, total, placing, onCheckout, onView }) => (
  <AnimatePresence>
    {count > 0 && (
      <motion.div
        className="floating-cart-wrapper"
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <div className="floating-cart">
          <button type="button" className="cart-info" onClick={onView} aria-label="Review cart">
            <motion.div className="cart-icon-wrapper" key={count} initial={{ scale: 0.85, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }}>
              <ShoppingBag size={20} />
              <span className="item-count">{count}</span>
            </motion.div>
            <div className="cart-text">
              <span className="cart-label">{count} item{count === 1 ? '' : 's'} · View cart</span>
              <AnimatedAmount value={total} />
            </div>
          </button>

          <motion.button className="checkout-btn" onClick={onCheckout} disabled={placing} whileTap={{ scale: 0.95 }}>
            {placing ? 'Placing…' : <>Checkout <ArrowRight size={17} /></>}
          </motion.button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default FloatingCart;
