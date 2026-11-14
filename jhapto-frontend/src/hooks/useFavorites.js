import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../contexts/auth';

// Hearted listings, saved per student in this browser
export default function useFavorites() {
  const { user } = useContext(AuthContext);
  const key = user ? `favorites:${user.student_id}` : null;

  const read = useCallback(() => {
    if (!key) return [];
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  }, [key]);

  const [ids, setIds] = useState(read);
  useEffect(() => { setIds(read()); }, [read]);

  const toggle = useCallback((listingId) => {
    setIds(prev => {
      const next = prev.includes(listingId) ? prev.filter(id => id !== listingId) : [...prev, listingId];
      try { if (key) localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, [key]);

  return { ids, isFavorite: (id) => ids.includes(id), toggle };
}
