import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';
import { getConfig } from '../utils/config';
import { readAuthMessage, clearAuthMessage } from '../utils/authMessage';
import { AnimatePresence, motion } from 'framer-motion';
import AuthShell from '../components/AuthShell';
import GoogleSignIn from '../components/GoogleSignIn';
import './AuthPage.css';

// Hostel + floor pickers, filled from the hostels admins have added
const HostelFloorPicker = ({ hostels, hostelId, floorId, onChange }) => {
  const hostel = hostels.find((h) => h.hostel_id === Number(hostelId)) || hostels[0];
  return (
    <div className="form-row">
      <select aria-label="Hostel" required value={hostel?.hostel_id || ''}
        onChange={(e) => {
          const h = hostels.find((x) => x.hostel_id === Number(e.target.value));
          onChange({ hostel_id: h.hostel_id, floor_id: h.floors[0]?.floor_id });
        }}>
        {hostels.map((h) => <option key={h.hostel_id} value={h.hostel_id}>{h.hostel_name}</option>)}
      </select>
      <select aria-label="Floor" required value={floorId || ''} onChange={(e) => onChange({ floor_id: Number(e.target.value) })}>
        {(hostel?.floors || []).map((f) => <option key={f.floor_id} value={f.floor_id}>Floor {f.floor_number}</option>)}
      </select>
    </div>
  );
};

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '', email: '', phone_no: '', password: '', hostel_id: '', floor_id: ''
  });
  const [hostels, setHostels] = useState([]);
  const [domains, setDomains] = useState(['thapar.edu']);
  const [googleSignup, setGoogleSignup] = useState(null);   // { signup_token, name, email } while finishing sign-up
  const [error, setError] = useState(readAuthMessage);
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(clearAuthMessage, []);

  const { loginUser, startSession, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/hostels').then((res) => {
      setHostels(res.data);
      const first = res.data[0];
      if (first) setFormData((f) => ({ ...f, hostel_id: f.hostel_id || first.hostel_id, floor_id: f.floor_id || first.floors[0]?.floor_id }));
    }).catch(() => {});
    getConfig().then((c) => { if (c.allowedEmailDomains?.length) setDomains(c.allowedEmailDomains); });
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const domainHint = `@${domains.join(' or @')}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      if (googleSignup) {
        const res = await api.post('/auth/google/complete', {
          signup_token: googleSignup.signup_token, name: formData.name,
          phone_no: formData.phone_no, hostel_id: formData.hostel_id, floor_id: formData.floor_id,
        });
        startSession(res.data);
        navigate('/');
      } else if (isLogin) {
        await loginUser(formData.email, formData.password);
        navigate('/');
      } else {
        await api.post('/auth/register', formData);
        setSuccess('Account created! Log in with your email and password.');
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async (credential) => {
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/auth/google', { credential });
      if (res.data.needs_profile) {
        setGoogleSignup(res.data);
        setFormData((f) => ({ ...f, name: res.data.name }));
      } else {
        startSession(res.data);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed.');
    }
  };

  if (user) return <Navigate to="/" replace />;

  const subtitle = googleSignup
    ? `Almost there! Tell us where you live, ${googleSignup.name.split(' ')[0]}.`
    : isLogin ? 'Welcome back! Log in to grab a snack.' : 'Create your account to buy and sell in your hostel.';

  return (
    <AuthShell>
        <h2 className="auth-title">jhapto<span>.</span></h2>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={subtitle} className="auth-subtitle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            {subtitle}
          </motion.p>
        </AnimatePresence>

        {error && <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && <div className="alert alert-success" role="status" style={{ marginBottom: '1rem' }}>{success}</div>}

        {googleSignup ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-google-account">Signed in as <strong>{googleSignup.email}</strong></div>
            <input type="text" name="name" placeholder="Full Name" required maxLength={100} value={formData.name} onChange={handleChange} />
            <input type="tel" name="phone_no" placeholder="Phone Number (10 digits)" required pattern="[6-9][0-9]{9}" title="10-digit mobile number" maxLength={10} value={formData.phone_no} onChange={handleChange} />
            <HostelFloorPicker hostels={hostels} hostelId={formData.hostel_id} floorId={formData.floor_id}
              onChange={(patch) => setFormData((f) => ({ ...f, ...patch }))} />
            <motion.button type="submit" className="auth-btn" whileTap={{ scale: 0.97 }} disabled={busy}>
              {busy ? 'Creating account…' : 'Finish sign-up'}
            </motion.button>
            <button type="button" className="auth-link muted" onClick={() => { setGoogleSignup(null); setError(''); }}>Cancel</button>
          </form>
        ) : (
          <>
            <GoogleSignIn onCredential={handleGoogle} onError={setError} />
            <div className="auth-divider"><span>or use email</span></div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <AnimatePresence initial={false}>
              {!isLogin && (
                <motion.div key="register-fields" className="auth-extra"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                  <input type="text" name="name" placeholder="Full Name" required maxLength={100} onChange={handleChange} />
                  <input type="tel" name="phone_no" placeholder="Phone Number (10 digits)" required pattern="[6-9][0-9]{9}" title="10-digit mobile number" maxLength={10} onChange={handleChange} />
                  <HostelFloorPicker hostels={hostels} hostelId={formData.hostel_id} floorId={formData.floor_id}
                    onChange={(patch) => setFormData((f) => ({ ...f, ...patch }))} />
                </motion.div>
              )}
              </AnimatePresence>

              <input type="email" name="email" placeholder={isLogin ? 'Email Address' : `Thapar email (${domainHint})`} required onChange={handleChange} />
              <input type="password" name="password" placeholder={isLogin ? 'Password' : 'Password (min 6 characters)'} required minLength={isLogin ? undefined : 6} onChange={handleChange} />

              <motion.button type="submit" className="auth-btn" whileTap={{ scale: 0.97 }} disabled={busy}>
                {isLogin ? 'Log in' : 'Create account'}
              </motion.button>
            </form>

            <p className="auth-switch">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button type="button" className="auth-link" onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}>
                {isLogin ? 'Register' : 'Log in'}
              </button>
            </p>

            <p className="auth-switch" style={{ marginTop: '0.75rem' }}>
              <button type="button" className="auth-link muted" onClick={() => navigate('/admin/login')}>Admin portal</button>
            </p>
          </>
        )}
    </AuthShell>
  );
};

export default AuthPage;
