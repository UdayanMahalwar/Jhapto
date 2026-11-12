import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import StarRating from '../components/StarRating';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';

const fieldStyle = { padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)' };
const labelStyle = { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--text-secondary)' };
const okStyle = { marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', border: '1px solid #2ecc71' };

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
      <Header cartCount={0} user={user} onLogout={logout} onOrdersClick={() => navigate('/orders')} onSellerClick={() => navigate('/seller')} />
      <div style={{ padding: '2rem 1rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 className="text-gradient" style={{ marginBottom: '1.5rem' }}>My Profile</h2>

        {!profile ? (
          <p style={{ opacity: 0.7 }}>Loading…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Details</h3>
              {profileMsg.text && (
                <div className={profileMsg.type === 'error' ? 'auth-error' : undefined} style={profileMsg.type === 'error' ? { marginBottom: '1rem' } : okStyle}>{profileMsg.text}</div>
              )}
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={labelStyle}>
                  Email (can't be changed)
                  <input type="email" value={profile.email} disabled style={{ ...fieldStyle, opacity: 0.6 }} />
                </label>
                <label style={labelStyle}>
                  Name
                  <input type="text" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  Phone number
                  <input type="tel" required pattern="[6-9][0-9]{9}" title="10-digit mobile number" maxLength={10} value={form.phone_no} onChange={(e) => setForm({ ...form, phone_no: e.target.value })} style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  Floor ({profile.hostel_name})
                  <select value={form.floor_id} onChange={(e) => setForm({ ...form, floor_id: e.target.value })} style={fieldStyle}>
                    {floors.map(f => <option key={f.floor_id} value={f.floor_id}>Floor {f.floor_number}</option>)}
                  </select>
                </label>
                <button type="submit" className="auth-btn" style={{ marginTop: 0 }}>Save details</button>
              </form>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Change password</h3>
              {pwMsg.text && (
                <div className={pwMsg.type === 'error' ? 'auth-error' : undefined} style={pwMsg.type === 'error' ? { marginBottom: '1rem' } : okStyle}>{pwMsg.text}</div>
              )}
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={labelStyle}>
                  Current password
                  <input type="password" required autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  New password (min 6 characters)
                  <input type="password" required minLength={6} autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} style={fieldStyle} />
                </label>
                <label style={labelStyle}>
                  Confirm new password
                  <input type="password" required minLength={6} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} style={fieldStyle} />
                </label>
                <button type="submit" className="auth-btn" style={{ marginTop: 0 }}>Change password</button>
              </form>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>My seller rating</h3>
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
      </div>
    </>
  );
};

export default ProfilePage;
