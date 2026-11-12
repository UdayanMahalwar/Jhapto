import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthPage from './pages/AuthPage';
import AdminAuthPage from './pages/AdminAuthPage';
import HomePage from './pages/HomePage';
import MyOrdersPage from './pages/MyOrdersPage';
import SellerDashboard from './pages/SellerDashboard';
import ChatPage from './pages/ChatPage';
import AdminDashboard from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';
import CartPage from './pages/CartPage';
import './App.css';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, admin, loading } = useContext(AuthContext);

  if (loading) return <div>Loading...</div>;

  if (requireAdmin) {
    if (!admin) return <Navigate to="/admin/login" />;
    return children;
  }

  if (!user) return <Navigate to="/login" />;
  return children;
};

// Each page fades and lifts in; the previous one fades out first
const pageMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16, ease: 'easeIn' } },
};

function AppRoutes() {
  const location = useLocation();
  // chat pages for different orders count as different pages
  const pageKey = location.pathname.startsWith('/chat/') ? location.pathname : location.pathname.split('/')[1] || 'home';

  return (
    <div className="app">
      <AnimatePresence mode="wait" initial={false}>
      <motion.div key={pageKey} className="page-transition" {...pageMotion}>
      <Routes location={location}>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/admin/login" element={<AdminAuthPage />} />
        
        {/* Protected Student Routes */}
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />
        <Route path="/seller" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
        <Route path="/chat/:order_id" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
        
        {/* Protected Admin Routes */}
        <Route path="/admin/dashboard" element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
        
        {/* Redirects */}
        <Route path="/admin" element={<Navigate to="/admin/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </motion.div>
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <Router>
                <AppRoutes />
              </Router>
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}

export default App;
