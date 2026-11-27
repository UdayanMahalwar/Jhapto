import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { hostelLabel } from '../utils/hostel';

// Admin › Hostels: list hostels with their student counts, and add a new hostel
const AdminHostels = () => {
  const [hostels, setHostels] = useState(null);
  const [form, setForm] = useState({ hostel_name: '', hostel_code: '' });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/admin/hostels').then((r) => setHostels(r.data)).catch(() => setHostels([]));
  useEffect(() => { load(); }, []);

  const addHostel = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await api.post('/admin/hostels', form);
      setMsg({ text: res.data.message, type: 'success' });
      setForm({ hostel_name: '', hostel_code: '' });
      load();
    } catch (err) {
      setMsg({ text: err.response?.data?.message || 'Could not add the hostel.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="section-heading">Hostels</h2>
      {hostels === null ? <p className="muted">Loading…</p> : (
        <table className="table" style={{ marginBottom: '2rem' }}>
          <thead><tr><th>Hostel</th><th>Code</th><th>Students</th></tr></thead>
          <tbody>
            {hostels.map((h) => (
              <tr key={h.hostel_id}>
                <td>{hostelLabel(h)}</td>
                <td>{h.hostel_code}</td>
                <td>{h.student_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="section-heading">Add a hostel</h3>
      {msg.text && (
        <div className={`alert ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`} role="status" style={{ marginBottom: '1rem', maxWidth: 420 }}>{msg.text}</div>
      )}
      <form onSubmit={addHostel} className="stack" style={{ maxWidth: 420, gap: '0.8rem' }}>
        <label className="field"><span>Hostel name</span>
          <input className="input" type="text" required maxLength={100} placeholder="e.g. Agira Hall"
            value={form.hostel_name} onChange={(e) => setForm({ ...form, hostel_name: e.target.value })} />
        </label>
        <label className="field"><span>Short code</span>
          <input className="input" type="text" required maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9/\-]*" placeholder="e.g. A"
            value={form.hostel_code} onChange={(e) => setForm({ ...form, hostel_code: e.target.value })} />
          <span className="field-hint">The hostel letter, e.g. A, PG or PG-2. Must be unique.</span>
        </label>
        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving}>
          {saving ? 'Adding…' : 'Add hostel'}
        </button>
      </form>
    </div>
  );
};

export default AdminHostels;
