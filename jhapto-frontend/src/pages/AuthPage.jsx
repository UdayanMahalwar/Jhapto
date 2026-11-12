import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';
import { readAuthMessage, clearAuthMessage } from '../utils/authMessage';
import { AnimatePresence, motion } from 'framer-motion';
import AuthShell from '../components/AuthShell';
import './AuthPage.css';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '', email: '', phone_no: '', password: '', hostel_id: 1, floor_id: 1
  });
  const [error, setError] = useState(readAuthMessage);
  const [success, setSuccess] = useState('');
  useEffect(clearAuthMessage, []);
  
  const { loginUser, user } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (isLogin) {
        await loginUser(formData.email, formData.password);
        navigate('/');
      } else {
        await api.post('/auth/register', formData);
        setSuccess('Account created! Log in with your email and password.');
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred.');
    }
  };

  if (user) return <Navigate to="/" replace />;

  return (
    <AuthShell>
        <h2 className="auth-title">jhapto<span>.</span></h2>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={isLogin ? 'in' : 'up'} className="auth-subtitle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            {isLogin ? 'Welcome back! Log in to grab a snack.' : 'Create your account to buy and sell in your hostel.'}
          </motion.p>
        </AnimatePresence>

        {error && <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && <div className="alert alert-success" role="status" style={{ marginBottom: '1rem' }}>{success}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <AnimatePresence initial={false}>
          {!isLogin && (
            <motion.div key="register-fields" className="auth-extra"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
              <input type="text" name="name" placeholder="Full Name" required maxLength={100} onChange={handleChange} />
              <input type="tel" name="phone_no" placeholder="Phone Number (10 digits)" required pattern="[6-9][0-9]{9}" title="10-digit mobile number" maxLength={10} onChange={handleChange} />
              
              <div className="form-row">
                <select name="hostel_id" onChange={handleChange} value={formData.hostel_id}>
                  <option value={1}>Kailash Hostel</option>
                </select>
                <select name="floor_id" onChange={handleChange} value={formData.floor_id}>
                  <option value={1}>Floor 1</option>
                  <option value={2}>Floor 2</option>
                  <option value={3}>Floor 3</option>
                  <option value={4}>Floor 4</option>
                  <option value={5}>Floor 5</option>
                  <option value={6}>Floor 6</option>
                </select>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
          
          <input type="email" name="email" placeholder="Email Address" required onChange={handleChange} />
          <input type="password" name="password" placeholder={isLogin ? 'Password' : 'Password (min 6 characters)'} required minLength={isLogin ? undefined : 6} onChange={handleChange} />
          
          <motion.button type="submit" className="auth-btn" whileTap={{ scale: 0.97 }}>
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
    </AuthShell>
  );
};

export default AuthPage;
