import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';
import { readAuthMessage, clearAuthMessage } from '../utils/authMessage';
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
    <div className="auth-container">
      <div className="auth-card glass-panel">
        <h2 className="text-gradient auth-title">JHAPTO</h2>
        <h3 className="auth-subtitle">{isLogin ? 'Welcome Back' : 'Create an Account'}</h3>
        
        {error && <div className="auth-error" role="alert">{error}</div>}
        {success && <div className="auth-error" role="status" style={{ background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', border: '1px solid #2ecc71' }}>{success}</div>}
        
        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <>
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
            </>
          )}
          
          <input type="email" name="email" placeholder="Email Address" required onChange={handleChange} />
          <input type="password" name="password" placeholder={isLogin ? 'Password' : 'Password (min 6 characters)'} required minLength={isLogin ? undefined : 6} onChange={handleChange} />
          
          <button type="submit" className="auth-btn">
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
        
        <p className="auth-switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }} className="text-gradient" style={{cursor: 'pointer'}}>
            {isLogin ? 'Register' : 'Login'}
          </span>
        </p>

        <p className="auth-switch" style={{ marginTop: '1rem' }}>
          <span onClick={() => navigate('/admin/login')} className="text-gradient" style={{cursor: 'pointer', opacity: 0.8, fontSize: '0.9rem'}}>
            Admin Portal Access
          </span>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
