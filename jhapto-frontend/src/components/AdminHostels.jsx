import React, { useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import api from '../utils/api';

// Admin › Hostels: list hostels, add a hostel with its floors, add floors to one
const AdminHostels = () => {
  const [hostels, setHostels] = useState(null);
  const [form, setForm] = useState({ hostel_name: '', hostel_code: '', floor_count: 4 });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = () => api.get('/admin/hostels').then((r) => setHostels(r.data)).catch(() => setHostels([]));
  useEffect(() => { load(); }, []);

  const addHostel = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await api.post('/admin/hostels', { ...form, floor_count: Number(form.floor_count) });
      setMsg({ text: res.data.message, type: 'success' });
      setForm({ hostel_name: '', hostel_code: '', floor_count: 4 });
      load();
    } catch (err) {
      setMsg({ text: err.response?.data?.message || 'Could not add the hostel.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const addFloors = async (h) => {
    const answer = window.prompt(`How many floors to add on top of ${h.hostel_name}'s floor ${h.floors.length ? Math.max(...h.floors) : 0}?`, '1');
    if (answer === null) return;
    try {
      const res = await api.post(`/admin/hostels/${h.hostel_id}/floors`, { floor_count: Number(answer) });
      toast(res.data.message);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Could not add floors.', 'error');
    }
  };

  return (
    <div>
      <h2 className="section-heading">Hostels</h2>
      {hostels === null ? <p className="muted">Loading…</p> : (
        <table className="table" style={{ marginBottom: '2rem' }}>
          <thead><tr><th>Hostel</th><th>Code</th><th>Floors</th><th>Students</th><th /></tr></thead>
          <tbody>
            {hostels.map((h) => (
              <tr key={h.hostel_id}>
                <td>{h.hostel_name}</td>
                <td>{h.hostel_code}</td>
                <td>{h.floors.length ? `${h.floors.length} (${Math.min(...h.floors)}–${Math.max(...h.floors)})` : 'None'}</td>
                <td>{h.student_count}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => addFloors(h)}>Add floors</button></td>
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
          <input className="input" type="text" required maxLength={100} placeholder="e.g. Amritam Hostel"
            value={form.hostel_name} onChange={(e) => setForm({ ...form, hostel_name: e.target.value })} />
        </label>
        <label className="field"><span>Short code</span>
          <input className="input" type="text" required maxLength={20} pattern="[A-Za-z0-9\-]+" placeholder="e.g. AH01"
            value={form.hostel_code} onChange={(e) => setForm({ ...form, hostel_code: e.target.value })} />
          <span className="field-hint">Letters, numbers and dashes. Must be unique.</span>
        </label>
        <label className="field"><span>Number of floors</span>
          <input className="input" type="number" required min={1} max={30}
            value={form.floor_count} onChange={(e) => setForm({ ...form, floor_count: e.target.value })} />
          <span className="field-hint">Floors are numbered 1, 2, 3 … Students pick one when they sign up.</span>
        </label>
        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving}>
          {saving ? 'Adding…' : 'Add hostel'}
        </button>
      </form>
    </div>
  );
};

export default AdminHostels;
