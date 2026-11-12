import React from 'react';
import { Plus, Minus } from 'lucide-react';
import StarRating from './StarRating';
import './ProductCard.css';

const ProductCard = ({ product, onAdd, onRemove, cartQuantity, isOwn = false }) => {
  return (
    <div className="product-card glass-panel">
      <div className="product-priority">
        {product.priority === 'Same Floor' ? (
          <span className="badge badge-primary">Same Floor Priority</span>
        ) : (
          <span className="badge badge-secondary">Floor {product.seller_floor_num || product.seller_floor}</span>
        )}
      </div>
      
      <div className="product-image-container">
        {product.photo_url ? (
          <img 
            src={product.photo_url} 
            alt={product.item_name} 
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} 
          />
        ) : (
          <div className="product-image-placeholder">
            {product.item_name.charAt(0)}
          </div>
        )}
      </div>
      
      <div className="product-info">
        <h4 className="product-name">{product.item_name}</h4>
        <p className="product-seller" style={{ margin: 0 }}>Sold by {isOwn ? 'you' : product.seller_name} {product.room_number ? `(Room ${product.room_number})` : ''}</p>
        {product.seller_rating_count !== undefined && (
          <div style={{ margin: '0.2rem 0' }}>
            <StarRating value={product.seller_rating || 0} count={Number(product.seller_rating_count) || 0} size={12} />
          </div>
        )}
        {product.category_name && <p className="product-seller" style={{ color: 'var(--primary-color)', fontSize: '0.75rem', marginBottom: '1rem' }}>{product.category_name}</p>}
        
        <div className="product-footer">
          <div className="product-price">
            <span className="price-symbol">₹</span>
            {product.selling_price}
          </div>
          
          {isOwn ? (
            <span className="badge badge-secondary">Your listing</span>
          ) : (
          <div className="cart-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {cartQuantity > 0 && (
              <>
                <button className="add-btn" onClick={() => onRemove(product)} style={{ background: 'var(--secondary-color)', color: 'white', borderColor: 'var(--secondary-color)' }}>
                  <Minus size={20} />
                </button>
                <span style={{ fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>{cartQuantity}</span>
              </>
            )}
            <button className="add-btn" onClick={() => onAdd(product)} aria-label={`Add ${product.item_name} to cart`}>
              <Plus size={20} />
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
