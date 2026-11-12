import React from 'react';

// Coloured pill for order and listing statuses
const VARIANTS = {
  Placed: 'warning',
  Confirmed: 'info',
  Delivered: 'success',
  Cancelled: 'danger',
  Active: 'success',
  OutOfStock: 'warning',
  Removed: 'neutral',
  Pending: 'warning',
  Resolved: 'success',
  Dismissed: 'neutral',
  Banned: 'danger',
};

const LABELS = { OutOfStock: 'Out of stock' };

const StatusBadge = ({ status }) => (
  <span className={`badge-pill badge-${VARIANTS[status] || 'neutral'}`}>{LABELS[status] || status}</span>
);

export default StatusBadge;
