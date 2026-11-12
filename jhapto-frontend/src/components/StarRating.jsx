import React, { useState } from 'react';
import { Star } from 'lucide-react';

// Read-only stars: <StarRating value={4.2} count={12} />
// Input stars:     <StarRating value={rating} onChange={setRating} size={28} />
const StarRating = ({ value = 0, count, onChange, size = 14 }) => {
  const [hover, setHover] = useState(0);
  const interactive = typeof onChange === 'function';
  const shown = interactive && hover ? hover : Number(value) || 0;

  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={interactive ? 'Choose a rating' : `Rated ${Number(value).toFixed(1)} out of 5`}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map(n => {
        const filled = shown >= n - 0.25;
        const star = (
          <Star
            size={size}
            fill={filled ? '#f1c40f' : 'transparent'}
            color={filled ? '#f1c40f' : 'rgba(255,255,255,0.35)'}
          />
        );
        return interactive ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={Number(value) === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', lineHeight: 0 }}
          >
            {star}
          </button>
        ) : <span key={n} style={{ lineHeight: 0 }}>{star}</span>;
      })}
      {count !== undefined && (
        <span style={{ fontSize: size * 0.85, color: 'var(--text-secondary)', marginLeft: '4px' }}>
          {count > 0 ? `${Number(value).toFixed(1)} (${count})` : 'No ratings yet'}
        </span>
      )}
    </span>
  );
};

export default StarRating;
