import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
import ReportsPage from './pages/ReportsPage';
import AppUpdatePrompt from './components/AppUpdatePrompt';
import BottomNav from './components/BottomNav';
import { enablePush } from './utils/push';
import { isNativeApp } from './utils/native';
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
// (quick, so switching tabs feels instant; the bottom bar stays still meanwhile)
const pageMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeIn' } },
};

// In the Android app, turn on push notifications once a student is logged in
// (Android asks for permission the first time). Tapping a notification opens its page.
function NativePushSetup() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const studentId = user?.student_id;
  useEffect(() => {
    if (studentId && isNativeApp()) enablePush((link) => navigate(link));
  }, [studentId, navigate]);
  return null;
}

function AppRoutes() {
  const location = useLocation();
  // chat pages for different orders count as different pages
  const pageKey = location.pathname.startsWith('/chat/') ? location.pathname : location.pathname.split('/')[1] || 'home';

  return (
    <div className="app">
      <NativePushSetup />
      <AppUpdatePrompt />
      {/* new pages start at the top (after the old one has faded out) */}
      <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo(0, 0)}>
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
        <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
        <Route path="/reports/:id" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
        
        {/* Protected Admin Routes */}
        <Route path="/admin/dashboard" element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
        
        {/* Redirects */}
        <Route path="/admin" element={<Navigate to="/admin/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </motion.div>
      </AnimatePresence>
      <BottomNav />
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
