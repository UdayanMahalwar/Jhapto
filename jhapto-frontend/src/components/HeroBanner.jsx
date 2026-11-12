import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import './HeroBanner.css';

// Floating emoji that drift on their own and lean toward the cursor
const FLOATERS = [
  { e: '🍜', x: '58%', y: '18%', size: 64, depth: 26, delay: 0 },
  { e: '🥤', x: '80%', y: '48%', size: 72, depth: 40, delay: 0.6 },
  { e: '🍫', x: '66%', y: '62%', size: 50, depth: 18, delay: 1.2 },
  { e: '🍿', x: '86%', y: '10%', size: 44, depth: 32, delay: 1.8 },
];

const Floater = ({ f, mx, my }) => {
  const x = useTransform(mx, [-0.5, 0.5], [-f.depth, f.depth]);
  const y = useTransform(my, [-0.5, 0.5], [-f.depth * 0.6, f.depth * 0.6]);
  return (
    <motion.div className="floater" style={{ left: f.x, top: f.y, fontSize: f.size, x, y }} aria-hidden="true">
      <motion.span
        style={{ display: 'inline-block' }}
        animate={{ y: [0, -10, 0], rotate: [0, 6, 0] }}
        transition={{ duration: 5 + f.delay, repeat: Infinity, ease: 'easeInOut', delay: f.delay }}
      >
        {f.e}
      </motion.span>
    </motion.div>
  );
};

const HeroBanner = ({ hostelName, listingCount }) => {
  const ref = useRef(null);
  const mx = useSpring(useMotionValue(0), { stiffness: 80, damping: 18 });
  const my = useSpring(useMotionValue(0), { stiffness: 80, damping: 18 });

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  return (
    <motion.section
      ref={ref}
      className="promo-banner"
      aria-label="Welcome"
      onMouseMove={onMove}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="promo-glow" aria-hidden="true" />
      <div className="promo-content">
        <motion.span className="promo-kicker" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
          {hostelName || 'Your hostel'} · {listingCount ? `${listingCount} item${listingCount === 1 ? '' : 's'} live` : 'live now'}
        </motion.span>
        <motion.h2 className="promo-title" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.5 }}>
          Late-night cravings?<br /><span>Delivered in minutes.</span>
        </motion.h2>
        <motion.p className="promo-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
          Snacks, drinks and essentials from students near you — sorted by who's closest.
        </motion.p>
      </div>
      <div className="promo-visual">
        {FLOATERS.map(f => <Floater key={f.e} f={f} mx={mx} my={my} />)}
      </div>
    </motion.section>
  );
};

export default HeroBanner;
