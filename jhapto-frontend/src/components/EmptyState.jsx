import React from 'react';

// <EmptyState icon={<Package size={22} />} title="No orders yet" text="…" action={<button …/>} />
const EmptyState = ({ icon, title, text, action }) => (
  <div className="empty-state">
    {icon && <div className="empty-state-icon" aria-hidden="true">{icon}</div>}
    {title && <h3>{title}</h3>}
    {text && <p>{text}</p>}
    {action}
  </div>
);

export default EmptyState;
