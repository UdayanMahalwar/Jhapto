import React, { createContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { disconnectSocket } from '../utils/socket';
import { forgetPushToken } from '../utils/push';

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

  // Stores a student session ({ token, student }) from password or Google sign-in
  const startSession = (data) => {
    disconnectSocket();
    localStorage.setItem('token', data.token);
    localStorage.removeItem('admin');
    localStorage.setItem('user', JSON.stringify(data.student));
    setAdmin(null);
    setUser(data.student);
    return data;
  };

  const loginUser = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return startSession(res.data);
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
    forgetPushToken(localStorage.getItem('token'));
    disconnectSocket();
    // drop saved carts so the next person on this browser starts empty
    Object.keys(localStorage).filter(k => k.startsWith('cart:')).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('admin');
    setUser(null);
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ user, admin, loading, loginUser, startSession, loginAdmin, updateUser, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
