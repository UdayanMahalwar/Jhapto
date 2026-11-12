import React, { useId } from 'react';
import { motion } from 'framer-motion';

// Segmented control with a sliding highlight. items: [{ key, label, count? }]
const Tabs = ({ items, value, onChange, label }) => {
  const id = useId();
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map(item => {
        const selected = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            className="tab"
            aria-selected={selected}
            onClick={() => onChange(item.key)}
          >
            {selected && <motion.span layoutId={`tab-pill-${id}`} className="tab-pill" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
            <span className="tab-text">
              {item.label}
              {item.count > 0 && <span className="tab-count">{item.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
