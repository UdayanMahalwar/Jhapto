import React from 'react';
import { motion } from 'framer-motion';
import { categoryIcon } from '../utils/categoryIcons';
import './CategoryList.css';

export const SAVED = '__saved__';

// Short labels so the chips stay compact
const shortName = (name) => name.split(' & ')[0];

// Pill chips; the highlight slides from chip to chip (shared layout animation)
const CategoryList = ({ categories, selectedCategory, onSelectCategory, savedCount = 0 }) => {
  if (!categories || categories.length === 0) return null;
  const chips = [
    { key: null, label: 'All', icon: '✨' },
    ...(savedCount > 0 ? [{ key: SAVED, label: `Saved`, icon: '♥', count: savedCount }] : []),
    ...categories.map(c => ({ key: c.category_name, label: shortName(c.category_name), icon: categoryIcon(c.category_name), title: c.category_name })),
  ];

  return (
    <div className="category-list" role="group" aria-label="Filter by category">
      {chips.map((chip, i) => {
        const active = selectedCategory === chip.key;
        return (
          <motion.button
            type="button"
            key={chip.key ?? 'all'}
            className={`category-chip ${active ? 'active' : ''}`}
            aria-pressed={active}
            title={chip.title || chip.label}
            onClick={() => onSelectCategory(active && chip.key !== null ? null : chip.key)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.94 }}
          >
            {active && <motion.span layoutId="category-pill" className="category-pill" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
            <span className={`category-emoji ${chip.key === SAVED ? 'saved' : ''}`} aria-hidden="true">{chip.icon}</span>
            <span className="category-label">{chip.label}</span>
            {chip.count > 0 && <span className="category-count">{chip.count}</span>}
          </motion.button>
        );
      })}
    </div>
  );
};

export default CategoryList;
