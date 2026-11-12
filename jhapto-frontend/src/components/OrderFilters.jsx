import React from 'react';

// Status + date-range filters for order lists.
// `value` = { status, from, to }; status '' means "all statuses for this tab".
const OrderFilters = ({ value, onChange, statusOptions }) => {
  const set = (patch) => onChange({ ...value, ...patch });
  const active = value.status || value.from || value.to;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', alignItems: 'end', marginBottom: '1.25rem' }}>
      <label className="field">
        <span>Status</span>
        <select className="input" value={value.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">All</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="field">
        <span>From</span>
        <input className="input" type="date" value={value.from} max={value.to || undefined} onChange={(e) => set({ from: e.target.value })} />
      </label>
      <label className="field">
        <span>To</span>
        <input className="input" type="date" value={value.to} min={value.from || undefined} onChange={(e) => set({ to: e.target.value })} />
      </label>
      {active && (
        <button type="button" className="btn btn-ghost" onClick={() => onChange({ status: '', from: '', to: '' })}>
          Clear filters
        </button>
      )}
    </div>
  );
};

export default OrderFilters;
