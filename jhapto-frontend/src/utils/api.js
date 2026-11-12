import axios from 'axios';
import { disconnectSocket } from './socket';

const api = axios.create({
  baseURL: '/api',
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// If the server says the session is invalid or the account is banned,
// clear the stored login and send the user back to the right login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.code;
    const hadToken = Boolean(error.config?.headers?.['Authorization']);
    if (hadToken && (code === 'INVALID_TOKEN' || code === 'ACCOUNT_BANNED')) {
      const wasAdmin = Boolean(localStorage.getItem('admin'));
      disconnectSocket();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('admin');
      try {
        sessionStorage.setItem('authMessage', error.response.data.message);
      } catch { /* storage unavailable */ }
      window.location.assign(wasAdmin ? '/admin/login' : '/login');
    }
    return Promise.reject(error);
  }
);

export default api;
