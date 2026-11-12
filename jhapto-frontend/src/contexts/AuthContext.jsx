import React, { createContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { disconnectSocket } from '../utils/socket';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user or admin is already logged in
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedAdmin = localStorage.getItem('admin');

    if (token) {
      if (storedUser) setUser(JSON.parse(storedUser));
      if (storedAdmin) setAdmin(JSON.parse(storedAdmin));
    }
    setLoading(false);
  }, []);

  const loginUser = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    disconnectSocket();
    localStorage.setItem('token', res.data.token);
    localStorage.removeItem('admin');
    localStorage.setItem('user', JSON.stringify(res.data.student));
    setAdmin(null);
    setUser(res.data.student);
    return res.data;
  };

  const loginAdmin = async (email, password) => {
    const res = await api.post('/admin/login', { email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.removeItem('user');
    setUser(null);
    const adminData = { ...res.data.admin, is_admin: true };
    localStorage.setItem('admin', JSON.stringify(adminData));
    setAdmin(adminData);
    return res.data;
  };

  // Merge changed profile fields (name, floor, ...) into the stored user
  const updateUser = (fields) => {
    setUser(prev => {
      const next = { ...prev, ...fields };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    disconnectSocket();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin');
    setUser(null);
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ user, admin, loading, loginUser, loginAdmin, updateUser, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
