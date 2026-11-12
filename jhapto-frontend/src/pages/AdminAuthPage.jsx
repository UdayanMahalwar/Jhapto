import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { readAuthMessage, clearAuthMessage } from '../utils/authMessage';
import AuthShell from '../components/AuthShell';
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
    <AuthShell>
        <h2 className="auth-title">jhapto<span>.</span> <small>admin</small></h2>
        <p className="auth-subtitle">Restricted access for hostel admins.</p>

        {error && <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <input type="email" name="email" placeholder="Admin Email" required onChange={handleChange} value={formData.email} />
          <input type="password" name="password" placeholder="Password" required onChange={handleChange} value={formData.password} />

          <button type="submit" className="auth-btn">Log in as admin</button>
        </form>

        <p className="auth-switch">
          Need admin access? Ask an existing admin to create an account for you.
        </p>

        <p className="auth-switch" style={{ marginTop: '1rem' }}>
          <button type="button" className="auth-link" onClick={() => navigate('/login')}>Back to student login</button>
        </p>
    </AuthShell>
  );
};

export default AdminAuthPage;
