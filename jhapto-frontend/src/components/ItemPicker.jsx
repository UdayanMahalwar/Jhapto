import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Search the catalogue as you type; if the item isn't there, add it as a new one.
// value: { item_id } for a catalogue item, or { new_item: { item_name, brand, category_id } }
const ItemPicker = ({ items, categories, value, onChange, initialQuery = '' }) => {
  const selected = value.item_id ? items.find((i) => Number(i.item_id) === Number(value.item_id)) : null;
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const q = norm(query);
  const matches = useMemo(() => {
    if (!q) return items.slice(0, 8);
    const words = q.split(' ');
    return items
      .filter((i) => { const hay = norm(`${i.item_name} ${i.brand || ''} ${i.category_name}`); return words.every((w) => hay.includes(w)); })
      .sort((a, b) => Number(!norm(a.item_name).startsWith(q)) - Number(!norm(b.item_name).startsWith(q)))
      .slice(0, 8);
  }, [items, q]);
  const exact = items.some((i) => norm(i.item_name) === q);
  const canAdd = q.length >= 2 && !exact;
  const options = [...matches.map((i) => ({ type: 'item', item: i })), ...(canAdd ? [{ type: 'new' }] : [])];

  const choose = (opt) => {
    if (!opt) return;
    if (opt.type === 'item') {
      onChange({ item_id: opt.item.item_id });
      setQuery('');
    } else {
      onChange({ new_item: { item_name: query.replace(/\s+/g, ' ').trim(), brand: '', category_id: categories[0]?.category_id || '' } });
    }
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); choose(options[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  // A chosen catalogue item
  if (selected) {
    return (
      <div className="item-chosen">
        <div>
          <strong>{selected.item_name}</strong>
          <span className="muted small"> · {selected.brand ? `${selected.brand} · ` : ''}{selected.category_name}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onChange({}); setOpen(true); }} aria-label="Change item">
          <X size={15} /> Change
        </button>
      </div>
    );
  }

  // A new item being added
  if (value.new_item) {
    const ni = value.new_item;
    const setNew = (patch) => onChange({ new_item: { ...ni, ...patch } });
    return (
      <div className="item-new stack">
        <div className="item-new-head">
          <span className="badge-pill badge-info">New item</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQuery(ni.item_name); onChange({}); setOpen(true); }}>
            <X size={15} /> Pick from list instead
          </button>
        </div>
        <label className="field"><span>Item name</span>
          <input className="input" type="text" required minLength={2} maxLength={150} value={ni.item_name}
            onChange={(e) => setNew({ item_name: e.target.value })} />
        </label>
        <div className="field-row">
          <label className="field"><span>Brand (optional)</span>
            <input className="input" type="text" maxLength={100} placeholder="e.g. Parle" value={ni.brand}
              onChange={(e) => setNew({ brand: e.target.value })} />
          </label>
          <label className="field"><span>Category</span>
            <select className="input" required value={ni.category_id} onChange={(e) => setNew({ category_id: Number(e.target.value) })}>
              {categories.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
            </select>
          </label>
        </div>
        <span className="field-hint">It’s added to the catalogue, so others can find and sell it too.</span>
      </div>
    );
  }

  return (
    <div className="item-picker" ref={wrapRef}>
      <div className="item-search">
        <Search size={16} aria-hidden="true" />
        <input className="input" type="text" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
          placeholder="Search items, e.g. Maggi, notebook, charger…" value={query} required
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)} onKeyDown={onKeyDown} />
      </div>
      {open && options.length > 0 && (
        <ul className="item-options" id={listId} role="listbox">
          {options.map((opt, i) => (
            <li key={opt.type === 'item' ? opt.item.item_id : 'new'} role="option" aria-selected={i === active}
              className={`item-option ${i === active ? 'active' : ''} ${opt.type === 'new' ? 'add' : ''}`}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(opt); }}>
              {opt.type === 'item' ? (
                <><span>{opt.item.item_name}</span><span className="muted small">{opt.item.brand ? `${opt.item.brand} · ` : ''}{opt.item.category_name}</span></>
              ) : (
                <span><Plus size={15} /> Add “{query.trim()}” as a new item</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && options.length === 0 && q.length < 2 && <div className="item-options muted small" style={{ padding: '0.75rem' }}>Type at least 2 letters</div>}
    </div>
  );
};

export default ItemPicker;
