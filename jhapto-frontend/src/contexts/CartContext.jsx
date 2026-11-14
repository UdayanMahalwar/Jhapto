import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from './auth';
import api from '../utils/api';

// Cart shared by the home page, the header and /cart. Saved per student in
// localStorage so it survives navigation and reloads; cleared on logout.
import { CartContext } from './cart';

const storageKey = (user) => (user ? `cart:${user.student_id}` : null);

const load = (key) => {
  if (!key) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const key = storageKey(user);
  const [items, setItems] = useState(() => load(key));
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);

  // switch carts when a different student logs in (or empty it on logout)
  useEffect(() => { setItems(load(key)); }, [key]);

  useEffect(() => {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* storage full/blocked */ }
  }, [key, items]);

  // Returns an error message, or null when added
  const add = useCallback((product) => {
    const inCart = items.find(i => i.listing_id === product.listing_id);
    if ((inCart ? inCart.quantity : 0) >= product.quantity_available) {
      return product.quantity_available < 1
        ? 'This item is out of stock!'
        : `Only ${product.quantity_available} units available in stock!`;
    }
    setItems(prev => inCart
      ? prev.map(i => i.listing_id === product.listing_id ? { ...i, quantity: i.quantity + 1 } : i)
      : [...prev, {
          listing_id: product.listing_id, item_name: product.item_name, seller_name: product.seller_name,
          selling_price: Number(product.selling_price), quantity_available: product.quantity_available,
          photo_url: product.photo_url, quantity: 1,
        }]);
    return null;
  }, [items]);

  const remove = useCallback((listing_id) => {
    setItems(prev => prev
      .map(i => i.listing_id === listing_id ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0));
  }, []);

  const removeAll = useCallback((listing_id) => {
    setItems(prev => prev.filter(i => i.listing_id !== listing_id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  // Places the whole cart in one transaction. Ignores repeat calls while a
  // checkout is in flight (double-clicks used to create duplicate orders).
  const checkout = useCallback(async () => {
    if (placingRef.current || items.length === 0) return null;
    placingRef.current = true;
    setPlacing(true);
    try {
      const res = await api.post('/orders/checkout', {
        items: items.map(i => ({ listing_id: i.listing_id, quantity: i.quantity })),
      });
      setItems([]);
      return res.data;
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  }, [items]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + i.selling_price * i.quantity, 0);
  const quantityOf = (listing_id) => (items.find(i => i.listing_id === listing_id) || {}).quantity || 0;

  return (
    <CartContext.Provider value={{ items, count, total, placing, add, remove, removeAll, clear, checkout, quantityOf }}>
      {children}
    </CartContext.Provider>
  );
};
