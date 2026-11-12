import React from 'react';
import './CategoryList.css';

// Icons for the categories created by jhapto_migrations_v3.sql; anything else gets 🛒
const ICONS = {
  'Snacks & Food': '🍿',
  'Noodles & Instant Food': '🍜',
  'Beverages': '🧃',
  'Chocolates & Sweets': '🍫',
  'Stationery & Books': '🖊️',
  'Personal Care': '🪥',
  'Electronics & Accessories': '🔌',
};

// Short labels so the cards stay compact
const shortName = (name) => name.split(' & ')[0];

const CategoryList = ({ categories, selectedCategory, onSelectCategory }) => {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="category-section">
      <h3 className="section-title">Shop by Category</h3>
      <div className="category-list" role="group" aria-label="Filter by category">
        {categories.map(category => {
          const active = selectedCategory === category.category_name;
          return (
            <button
              type="button"
              key={category.category_id}
              className={`category-card glass-panel ${active ? 'active' : ''}`}
              aria-pressed={active}
              title={category.category_name}
              onClick={() => onSelectCategory(active ? null : category.category_name)}
              style={{
                color: 'inherit', font: 'inherit',
                ...(active ? { borderColor: 'var(--primary-color)', background: 'rgba(69, 243, 255, 0.1)', transform: 'translateY(-5px)', boxShadow: '0 10px 20px rgba(0, 0, 0, 0.3)' } : {}),
              }}
            >
              <div className="category-icon">{ICONS[category.category_name] || '🛒'}</div>
              <span className="category-name">{shortName(category.category_name)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryList;
