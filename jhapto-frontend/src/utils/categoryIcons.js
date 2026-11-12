// Emoji for the categories created by jhapto_migrations_v3.sql; anything else gets 🛒
const ICONS = {
  'Snacks & Food': '🍿',
  'Noodles & Instant Food': '🍜',
  'Beverages': '🧃',
  'Chocolates & Sweets': '🍫',
  'Stationery & Books': '🖊️',
  'Personal Care': '🪥',
  'Electronics & Accessories': '🔌',
};

export const categoryIcon = (name) => ICONS[name] || '🛒';
