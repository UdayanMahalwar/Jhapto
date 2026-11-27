import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import StarRating from '../components/StarRating';
import AppDownload from '../components/AppDownload';
import HostelRoomFields from '../components/HostelRoomFields';
import { LogOut, Flag, ChevronRight } from 'lucide-react';
import { enablePush, pushStatus } from '../utils/push';
import { isNativeApp } from '../utils/native';
import { AuthContext } from '../contexts/auth';
import api from '../utils/api';


const ProfilePage = () => {
  const { user, logout, updateUser, startSession } = useContext(AuthContext);
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [hostels, setHostels] = useState([]);
  const [form, setForm] = useState({ name: '', phone_no: '', hostel_id: '', room_number: '' });
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });

  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState({ text: '', type: '' });

  const [reviews, setReviews] = useState([]);
  const [push, setPush] = useState('unsupported');   // granted | prompt | denied | unsupported
  const [alertMsg, setAlertMsg] = useState('');

  useEffect(() => { pushStatus().then(setPush).catch(() => {}); }, []);

  const toggleEmail = async () => {
    const next = !profile.email_notifications;
    setProfile((p) => ({ ...p, email_notifications: next }));
    try {
      await api.patch('/auth/me', { email_notifications: next });
      setAlertMsg(next ? 'Email alerts on.' : 'Email alerts off.');
    } catch {
      setProfile((p) => ({ ...p, email_notifications: !next }));
      setAlertMsg('Could not change email alerts.');
    }
  };

  const turnOnPush = async () => {
    const result = await enablePush((link) => navigate(link));
    setPush(result === 'granted' ? 'granted' : await pushStatus());
    setAlertMsg(result === 'granted' ? 'Notifications on for this device.'
      : result === 'denied' ? 'Notifications are blocked. Allow them in your browser or phone settings.'
        : 'This browser can’t show notifications.');
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [me, hs] = await Promise.all([api.get('/auth/me'), api.get('/auth/hostels')]);
        setProfile(me.data);
        setHostels(hs.data);
        setForm({ name: me.data.name, phone_no: me.data.phone_no, hostel_id: me.data.hostel_id, room_number: me.data.room_number || '' });
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
    if (Number(form.hostel_id) !== Number(profile.hostel_id)) changes.hostel_id = Number(form.hostel_id);
    if (form.room_number.trim().toUpperCase() !== (profile.room_number || '')) changes.room_number = form.room_number.trim();
    if (Object.keys(changes).length === 0) {
      return setProfileMsg({ text: 'Nothing changed.', type: 'success' });
    }
    try {
      const res = await api.patch('/auth/me', changes);
      const p = res.data.profile;
      setProfile(p);
      updateUser({ name: p.name, floor_id: p.floor_id, hostel_id: p.hostel_id, hostel_name: p.hostel_name, hostel_code: p.hostel_code, room_number: p.room_number });
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
      // other devices are signed out; keep this one logged in with the fresh token
      if (res.data.token) startSession(res.data);
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

        {profile && !profile.room_number && (
          <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
            Add your hostel and room number below — buyers collect your items from there, and you need it to sell.
          </div>
        )}

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
                <HostelRoomFields labelled hostels={hostels} hostelId={form.hostel_id} room={form.room_number}
                  onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
                <button type="submit" className="btn btn-primary">Save details</button>
              </form>
            </div>

            <div className="card card-lg">
              <h2 className="section-heading">Alerts &amp; reports</h2>
              {alertMsg && <div className="alert alert-success" role="status" style={{ marginBottom: '0.75rem' }}>{alertMsg}</div>}
              <div className="setting-row">
                <div className="setting-row-text">
                  <strong>Email alerts</strong>
                  <span className="muted small">New orders, order updates, ratings and replies to your reports, sent to {profile.email}.</span>
                </div>
                <button type="button" className="switch" role="switch" aria-checked={Boolean(profile.email_notifications)}
                  aria-label="Email alerts" onClick={toggleEmail} />
              </div>
              <div className="setting-row">
                <div className="setting-row-text">
                  <strong>{isNativeApp() ? 'Phone notifications' : 'Browser notifications'}</strong>
                  <span className="muted small">
                    {push === 'granted' ? 'On for this device.'
                      : push === 'denied' ? 'Blocked — allow notifications for Jhapto in your settings.'
                        : push === 'unsupported' ? 'Not available here. Get the Android app for phone alerts.'
                          : 'Get an alert the moment something happens.'}
                  </span>
                </div>
                {push === 'prompt' && <button type="button" className="btn btn-primary btn-sm" onClick={turnOnPush}>Turn on</button>}
              </div>
              <button type="button" className="setting-row report-link" onClick={() => navigate('/reports')}>
                <span className="setting-row-text">
                  <strong><Flag size={14} /> My reports</strong>
                  <span className="muted small">Follow your reports and talk to the admins.</span>
                </span>
                <ChevronRight size={18} />
              </button>
            </div>

            {!profile.has_password ? (
              <div className="card card-lg">
                <h2 className="section-heading">Sign-in</h2>
                <p className="muted">You sign in with your Google account ({profile.email}), so there's no password to manage.</p>
              </div>
            ) : (
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
                  <span>New password (min 8 characters)</span>
                  <input type="password" required minLength={8} autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} className="input" />
                </label>
                <label className="field">
                  <span>Confirm new password</span>
                  <input type="password" required minLength={8} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} className="input" />
                </label>
                <button type="submit" className="btn btn-secondary">Change password</button>
              </form>
            </div>
            )}

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
