import React from 'react';
import StatusBadge from './StatusBadge';
import StarRating from './StarRating';

const formatDate = (d) => new Date(d).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// One order, as seen by the buyer (role="buyer") or the seller (role="seller").
// Action buttons are passed as children.
const OrderCard = ({ order, role, children }) => {
  const isBuyer = role === 'buyer';
  const otherName = isBuyer ? order.seller_name : order.buyer_name;
  const otherPhone = isBuyer ? order.seller_phone : order.buyer_phone;
  const rating = isBuyer ? order.my_rating : order.buyer_rating;
  const review = isBuyer ? order.my_review : order.buyer_review;

  return (
    <article className="card order-card" aria-label={`Order ${order.order_id}`}>
      <div className="order-card-head">
        <div style={{ minWidth: 0 }}>
          <div className="order-card-title">{order.item_name} <span className="muted" style={{ fontWeight: 500 }}>× {order.quantity}</span></div>
          <div className="muted small">Order #{order.order_id} · {formatDate(order.created_at)}</div>
        </div>
        <StatusBadge status={order.order_status} />
      </div>

      <dl className="order-card-meta">
        <div>
          <dt>{isBuyer ? 'Seller' : 'Buyer'}</dt>
          <dd>{otherName}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{otherPhone ? <a href={`tel:${otherPhone}`}>{otherPhone}</a> : '—'}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>₹{Number(order.total_amount).toFixed(2)}</dd>
        </div>
      </dl>

      {rating && (
        <div className="small">
          <span className="muted">{isBuyer ? 'Your rating' : 'Buyer rated you'}</span>{' '}
          <StarRating value={rating} />
          {review && <div className="muted" style={{ fontStyle: 'italic', marginTop: '0.2rem' }}>“{review}”</div>}
        </div>
      )}

      {children && <div className="order-card-actions">{children}</div>}
    </article>
  );
};

export default OrderCard;
