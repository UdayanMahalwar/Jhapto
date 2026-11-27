import React, { useContext, useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { AuthContext } from '../contexts/auth';
import HostelRoomFields from './HostelRoomFields';
import api from '../utils/api';

// Accounts created before rooms existed (or whose hostel was retired) must pick
// their hostel and room once: sellers' listings use it as the pickup room.
const CompleteDetails = () => {
  const { user, updateUser, logout } = useContext(AuthContext);
  const [needed, setNeeded] = useState(false);
  const [hostels, setHostels] = useState([]);
  const [form, setForm] = useState({ hostel_id: '', room_number: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Refresh the stored login with the latest profile (older sessions lack hostel/room)
  useEffect(() => {
    if (!user) { setNeeded(false); return; }
    let cancelled = false;
    api.get('/auth/me').then((res) => {
      if (cancelled) return;
      const p = res.data;
      updateUser({ hostel_id: p.hostel_id, hostel_name: p.hostel_name, hostel_code: p.hostel_code, room_number: p.room_number, floor_id: p.floor_id });
      if (!p.room_number) {
        setNeeded(true);
        setForm({ hostel_id: '', room_number: '' });
        api.get('/auth/hostels').then((h) => setHostels(h.data)).catch(() => {});
      }
    }).catch(() => {});
    return () => { cancelled = true; };
    // once per logged-in student (updateUser changes the user object itself)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.student_id]);

  if (!needed) return null;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.patch('/auth/me', { hostel_id: Number(form.hostel_id), room_number: form.room_number });
      const p = res.data.profile;
      updateUser({ hostel_id: p.hostel_id, hostel_name: p.hostel_name, hostel_code: p.hostel_code, room_number: p.room_number, floor_id: p.floor_id });
      setNeeded(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save your details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="details-title" style={{ zIndex: 1700 }}>
      <form className="modal stack" style={{ maxWidth: 420 }} onSubmit={save}>
        <div className="update-icon" aria-hidden="true"><MapPin size={22} /></div>
        <h3 id="details-title" className="modal-title" style={{ textAlign: 'center', margin: 0 }}>Where do you live?</h3>
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>
          Pick your Thapar hostel and room. Buyers collect your items from this room, and listings near you show first.
        </p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <HostelRoomFields labelled hostels={hostels} hostelId={form.hostel_id} room={form.room_number}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn btn-ghost btn-block" onClick={logout}>Log out</button>
      </form>
    </div>
  );
};

export default CompleteDetails;
