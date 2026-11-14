import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Minus, Heart, Star } from 'lucide-react';
import { categoryIcon } from '../utils/categoryIcons';
import './ProductCard.css';

const spring = { type: 'spring', stiffness: 520, damping: 32 };

const ProductCard = ({ product, onAdd, onRemove, cartQuantity, isOwn = false, isFavorite = false, onToggleFavorite, index = 0 }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const rating = Number(product.seller_rating_count) > 0 ? Number(product.seller_rating).toFixed(1) : null;
  const sameFloor = product.priority === 'Same Floor';

  return (
    <motion.article
      layout
      className="product-card"
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 8) * 0.045 }}
      whileHover={{ y: -6 }}
    >
      <div className="product-top">
        {onToggleFavorite && (
          <motion.button
            type="button"
            className={`fav-btn ${isFavorite ? 'on' : ''}`}
            onClick={() => onToggleFavorite(product.listing_id)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Remove ${product.item_name} from saved` : `Save ${product.item_name}`}
            whileTap={{ scale: 0.75 }}
          >
            <motion.span key={String(isFavorite)} initial={{ scale: isFavorite ? 0.4 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 12 }} style={{ display: 'flex' }}>
              <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </motion.span>
          </motion.button>
        )}
        <span className={`product-floor ${sameFloor ? 'same' : ''}`}>
          {sameFloor ? 'Your floor' : `Floor ${product.seller_floor_num || product.seller_floor}`}
        </span>
      </div>

      <div className="product-image">
        {product.photo_url && !imageFailed ? (
          <img src={product.photo_url} alt={product.item_name} loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <span className="product-emoji" aria-hidden="true">{categoryIcon(product.category_name)}</span>
        )}
        {!isOwn && product.quantity_available <= 3 && (
          <span className="product-stock">Only {product.quantity_available} left</span>
        )}
      </div>

      <div className="product-info">
        <h4 className="product-name">{product.item_name}</h4>
        <p className="product-seller">
          {isOwn ? 'Your listing' : product.seller_name}{product.room_number ? ` · Room ${product.room_number}` : ''}
        </p>

        <div className="product-footer">
          <div>
            <div className="product-price">
              ₹{Number(product.selling_price).toFixed(2)}
              {Number(product.mrp) > Number(product.selling_price) && <span className="product-mrp">₹{Number(product.mrp).toFixed(0)}</span>}
            </div>
            <div className="product-rating">
              <Star size={14} fill="currentColor" className="star" />
              {rating ? <><strong>{rating}</strong><span>({product.seller_rating_count})</span></> : <span>New seller</span>}
            </div>
          </div>

          {!isOwn && (
            <AnimatePresence mode="popLayout" initial={false}>
              {cartQuantity > 0 ? (
                <motion.div key="stepper" className="cart-stepper" role="group" aria-label={`${product.item_name} quantity`}
                  initial={{ opacity: 0, scale: 0.6, width: 40 }} animate={{ opacity: 1, scale: 1, width: 'auto' }} exit={{ opacity: 0, scale: 0.6 }} transition={spring}>
                  <button onClick={() => onRemove(product)} aria-label={`One less ${product.item_name}`}><Minus size={15} /></button>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span key={cartQuantity} initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ duration: 0.18 }} aria-live="polite">
                      {cartQuantity}
                    </motion.span>
                  </AnimatePresence>
                  <button onClick={() => onAdd(product)} aria-label={`One more ${product.item_name}`}><Plus size={15} /></button>
                </motion.div>
              ) : (
                <motion.button key="add" className="add-btn" onClick={() => onAdd(product)} aria-label={`Add ${product.item_name} to cart`}
                  initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={spring}
                  whileHover={{ scale: 1.08, rotate: 90 }} whileTap={{ scale: 0.88 }}>
                  <Plus size={20} />
                </motion.button>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.article>
  );
};

export default ProductCard;
