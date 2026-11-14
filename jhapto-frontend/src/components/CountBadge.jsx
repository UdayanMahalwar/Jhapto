import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Small badge that pops whenever the number changes
const CountBadge = ({ count, className = 'cart-badge' }) => (
  <AnimatePresence>
    {count > 0 && (
      <motion.span
        key={count}
        className={className}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.4, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 18 }}
      >
        {count > 99 ? '99+' : count}
      </motion.span>
    )}
  </AnimatePresence>
);

export default CountBadge;
