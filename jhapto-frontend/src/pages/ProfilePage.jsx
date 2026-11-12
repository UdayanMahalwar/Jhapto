import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import StarRating from '../components/StarRating';
import AppDownload from '../components/AppDownload';
import { LogOut } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';


const ProfilePage = () => {
  const { user, logout, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [floors, setFloors] = useState([]);
  const [form, setForm] = useState({ name: '', phone_no: '', floor_id: '' });
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });

  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState({ text: '', type: '' });

  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [me, fl] = await Promise.all([api.get('/auth/me'), api.get('/auth/floors')]);
        setProfile(me.data);
        setFloors(fl.data);
        setForm({ name: me.data.name, phone_no: me.data.phone_no, floor_id: String(me.data.floor_id) });
        const rv = await api.get(`/reviews/seller/${me.data.student_id}`);
        setReviews(rv.data.reviews);
      } catch (err) {
        console.error('Error loading profile', err);
      }
    };
    load();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ text: '', type: '' });
    const changes = {};
    if (form.name.trim() !== profile.name) changes.name = form.name.trim();
    if (form.phone_no.trim() !== profile.phone_no) changes.phone_no = form.phone_no.trim();
    if (Number(form.floor_id) !== Number(profile.floor_id)) changes.floor_id = Number(form.floor_id);
    if (Object.keys(changes).length === 0) {
      return setProfileMsg({ text: 'Nothing changed.', type: 'success' });
    }
    try {
      const res = await api.patch('/auth/me', changes);
      const p = res.data.profile;
      setProfile(p);
      updateUser({ name: p.name, floor_id: p.floor_id, floor_number: p.floor_number });
      setProfileMsg({ text: 'Profile updated.', type: 'success' });
    } catch (err) {
      setProfileMsg({ text: err.response?.data?.message || 'Error updating profile', type: 'error' });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ text: '', type: '' });
    if (pw.new_password !== pw.confirm) {
      return setPwMsg({ text: 'New passwords do not match.', type: 'error' });
    }
    try {
      const res = await api.patch('/auth/me/password', { current_password: pw.current_password, new_password: pw.new_password });
      setPw({ current_password: '', new_password: '', confirm: '' });
      setPwMsg({ text: res.data.message, type: 'success' });
    } catch (err) {
      setPwMsg({ text: err.response?.data?.message || 'Error changing password', type: 'error' });
    }
  };

  return (
    <>
      <Header user={user} onLogout={logout} onOrdersClick={() => navigate('/orders')} onSellerClick={() => navigate('/seller')} />
      <main className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Profile</h1>
            <p className="page-subtitle">Your details, password and seller rating.</p>
          </div>
          <div className="page-header-actions">
            <AppDownload />
            <button className="btn btn-ghost" onClick={logout}><LogOut size={16} /> Log out</button>
          </div>
        </div>

        {!profile ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="profile-grid">
            <div className="card card-lg">
              <h2 className="section-heading">Details</h2>
              {profileMsg.text && (
                <div className={`alert ${profileMsg.type === 'error' ? 'alert-error' : 'alert-success'}`} role="status" style={{ marginBottom: '1rem' }}>{profileMsg.text}</div>
              )}
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label className="field">
                  <span>Email (can't be changed)</span>
                  <input type="email" value={profile.email} disabled className="input" />
                </label>
                <label className="field">
                  <span>Name</span>
                  <input type="text" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
                </label>
                <label className="field">
                  <span>Phone number</span>
                  <input type="tel" required pattern="[6-9][0-9]{9}" title="10-digit mobile number" maxLength={10} value={form.phone_no} onChange={(e) => setForm({ ...form, phone_no: e.target.value })} className="input" />
                </label>
                <label className="field">
                  <span>Floor ({profile.hostel_name})</span>
                  <select value={form.floor_id} onChange={(e) => setForm({ ...form, floor_id: e.target.value })} className="input">
                    {floors.map(f => <option key={f.floor_id} value={f.floor_id}>Floor {f.floor_number}</option>)}
                  </select>
                </label>
                <button type="submit" className="btn btn-primary">Save details</button>
              </form>
            </div>

            <div className="card card-lg">
              <h2 className="section-heading">Change password</h2>
              {pwMsg.text && (
                <div className={`alert ${pwMsg.type === 'error' ? 'alert-error' : 'alert-success'}`} role="status" style={{ marginBottom: '1rem' }}>{pwMsg.text}</div>
              )}
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label className="field">
                  <span>Current password</span>
                  <input type="password" required autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} className="input" />
                </label>
                <label className="field">
                  <span>New password (min 6 characters)</span>
                  <input type="password" required minLength={6} autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} className="input" />
                </label>
                <label className="field">
                  <span>Confirm new password</span>
                  <input type="password" required minLength={6} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="input" />
                </label>
                <button type="submit" className="btn btn-secondary">Change password</button>
              </form>
            </div>

            <div className="card card-lg" style={{ gridColumn: '1 / -1' }}>
              <h2 className="section-heading" style={{ marginBottom: '0.5rem' }}>My seller rating</h2>
              <div style={{ marginBottom: '1rem' }}>
                <StarRating value={profile.avg_rating || 0} count={profile.rating_count} size={20} />
              </div>
              {reviews.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>Buyers can rate you after you deliver an order.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {reviews.map(r => (
                    <div key={r.review_id} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <StarRating value={r.rating} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {r.reviewer_name} · {r.item_name} · {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {r.comment && <p style={{ marginTop: '0.3rem', fontSize: '0.9rem' }}>{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
};

export default ProfilePage;
