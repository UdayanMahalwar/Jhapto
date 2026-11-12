import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { readAuthMessage, clearAuthMessage } from '../utils/authMessage';
import '../pages/AuthPage.css';

// Admin login only. New admins are created by an existing admin
// from the "Admins" tab of the dashboard.
const AdminAuthPage = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState(readAuthMessage);
  useEffect(clearAuthMessage, []);

  const { loginAdmin } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await loginAdmin(formData.email, formData.password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred during login.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel" style={{ border: '1px solid var(--secondary-color)' }}>
        <h2 className="text-gradient auth-title">JHAPTO ADMIN</h2>
        <h3 className="auth-subtitle">Restricted Access</h3>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <input type="email" name="email" placeholder="Admin Email" required onChange={handleChange} value={formData.email} />
          <input type="password" name="password" placeholder="Password" required onChange={handleChange} value={formData.password} />

          <button type="submit" className="auth-btn" style={{ background: 'linear-gradient(90deg, var(--secondary-color), #ff9a9e)' }}>
            Admin Login
          </button>
        </form>

        <p className="auth-switch">
          Need admin access? Ask an existing admin to create an account for you.
        </p>

        <p className="auth-switch" style={{ marginTop: '1rem' }}>
          <span onClick={() => navigate('/login')} className="text-gradient" style={{cursor: 'pointer'}}>
            Back to Student Portal
          </span>
        </p>
      </div>
    </div>
  );
};

export default AdminAuthPage;
