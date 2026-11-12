import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import StarRating from './StarRating';
import { categoryIcon } from '../utils/categoryIcons';
import './ProductCard.css';

const ProductCard = ({ product, onAdd, onRemove, cartQuantity, isOwn = false }) => {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className="product-card glass-panel">
      <div className="product-image-container">
        {product.photo_url && !imageFailed ? (
          <img
            src={product.photo_url}
            alt={product.item_name}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="product-image-placeholder" aria-hidden="true">
            {categoryIcon(product.category_name)}
          </div>
        )}
        <span className={`product-floor ${product.priority === 'Same Floor' ? 'same' : ''}`}>
          {product.priority === 'Same Floor' ? 'Your floor' : `Floor ${product.seller_floor_num || product.seller_floor}`}
        </span>
        {!isOwn && product.quantity_available <= 3 && (
          <span className="product-stock">Only {product.quantity_available} left</span>
        )}
      </div>

      <div className="product-info">
        <h4 className="product-name">{product.item_name}</h4>
        <p className="product-seller">
          {isOwn ? 'Your listing' : product.seller_name}{product.room_number ? ` · Room ${product.room_number}` : ''}
        </p>
        {product.seller_rating_count !== undefined && !isOwn && (
          <div className="product-rating">
            <StarRating value={product.seller_rating || 0} count={Number(product.seller_rating_count) || 0} size={12} />
          </div>
        )}

        <div className="product-footer">
          <div className="product-price">
            <span className="price-symbol">₹</span>{Number(product.selling_price).toFixed(2)}
            {Number(product.mrp) > Number(product.selling_price) && (
              <span className="product-mrp">₹{Number(product.mrp).toFixed(2)}</span>
            )}
          </div>

          {isOwn ? null : cartQuantity > 0 ? (
            <div className="cart-stepper" role="group" aria-label={`${product.item_name} quantity`}>
              <button onClick={() => onRemove(product)} aria-label={`One less ${product.item_name}`}><Minus size={16} /></button>
              <span aria-live="polite">{cartQuantity}</span>
              <button onClick={() => onAdd(product)} aria-label={`One more ${product.item_name}`}><Plus size={16} /></button>
            </div>
          ) : (
            <button className="add-btn" onClick={() => onAdd(product)} aria-label={`Add ${product.item_name} to cart`}>
              <Plus size={18} /> <span>Add</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
