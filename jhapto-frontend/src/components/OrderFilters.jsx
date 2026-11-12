import React from 'react';

// Status + date-range filters for order history lists.
// `value` = { status, from, to }; status '' means "all statuses for this tab".
const fieldStyle = {
  padding: '0.5rem 0.7rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)',
  color: 'white', border: '1px solid var(--border-color)', colorScheme: 'dark',
};

const OrderFilters = ({ value, onChange, statusOptions }) => {
  const set = (patch) => onChange({ ...value, ...patch });
  const active = value.status || value.from || value.to;

  return (
    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Status
        <select value={value.status} onChange={(e) => set({ status: e.target.value })} style={fieldStyle}>
          <option value="">All</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        From
        <input type="date" value={value.from} max={value.to || undefined} onChange={(e) => set({ from: e.target.value })} style={fieldStyle} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        To
        <input type="date" value={value.to} min={value.from || undefined} onChange={(e) => set({ to: e.target.value })} style={fieldStyle} />
      </label>
      {active && (
        <button type="button" onClick={() => onChange({ status: '', from: '', to: '' })}
          style={{ ...fieldStyle, cursor: 'pointer', background: 'transparent' }}>
          Clear
        </button>
      )}
    </div>
  );
};

export default OrderFilters;
