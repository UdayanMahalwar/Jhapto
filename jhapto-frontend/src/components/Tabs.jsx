import React from 'react';

// Segmented control. items: [{ key, label, count? }]
const Tabs = ({ items, value, onChange, label }) => (
  <div className="tabs" role="tablist" aria-label={label}>
    {items.map(item => (
      <button
        key={item.key}
        type="button"
        role="tab"
        className="tab"
        aria-selected={value === item.key}
        onClick={() => onChange(item.key)}
      >
        {item.label}
        {item.count > 0 && <span className="tab-count">{item.count}</span>}
      </button>
    ))}
  </div>
);

export default Tabs;
