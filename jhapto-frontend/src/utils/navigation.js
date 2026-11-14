import { Home, Package, Store } from 'lucide-react';

// Main sections (the header shows the first three on desktop)
export const NAV = [
  { to: '/', label: 'Home', icon: Home, match: (p) => p === '/' },
  { to: '/orders', label: 'Orders', icon: Package, match: (p) => p.startsWith('/orders') || p.startsWith('/chat') },
  { to: '/seller', label: 'Sell', icon: Store, match: (p) => p.startsWith('/seller') },
];

