import React, { useState } from 'react';
import api from '../utils/api';
import StarRating from './StarRating';

const LABELS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Excellent'];

// Buyer rates the seller of a delivered order
const RateDialog = ({ order, onClose, onSaved }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setError('Pick a star rating.');
    setSaving(true);
    try {
      await api.post('/reviews', { order_id: order.order_id, rating, comment });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving review');
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rate-title">
      <form className="modal stack" onSubmit={submit}>
        <div>
          <h3 id="rate-title" className="modal-title">Rate {order.seller_name}</h3>
          <p className="muted small">Order #{order.order_id} · {order.item_name}</p>
        </div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="row">
          <StarRating value={rating} onChange={setRating} size={32} />
          <span className="muted small">{LABELS[rating]}</span>
        </div>
        <label className="field">
          <span>Comment (optional)</span>
          <textarea className="input" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Anything other students should know?" />
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Submit rating'}</button>
        </div>
      </form>
    </div>
  );
};

export default RateDialog;
