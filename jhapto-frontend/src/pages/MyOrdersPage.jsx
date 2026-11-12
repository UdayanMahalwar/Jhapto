import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';
import OrderFilters from '../components/OrderFilters';
import StarRating from '../components/StarRating';
import { STATUSES_FOR_TAB, EMPTY_FILTERS, orderFilterParams } from '../utils/orderFilters';

const MyOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'history'
  const [reportModal, setReportModal] = useState({ show: false, order: null });
  const [reportReason, setReportReason] = useState('');
  const [reportProof, setReportProof] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState(null); // order being rated
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filters]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/orders/my', { params: orderFilterParams(activeTab, filters) });
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setFilters(EMPTY_FILTERS);
  };

  const openReview = (order) => {
    setReviewModal(order);
    setReviewRating(0);
    setReviewComment('');
    setReviewError('');
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!reviewRating) return setReviewError('Pick a star rating.');
    try {
      await api.post('/reviews', { order_id: reviewModal.order_id, rating: reviewRating, comment: reviewComment });
      setReviewModal(null);
      fetchOrders();
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Error saving review');
    }
  };

  const handleCancel = async (order_id) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      await api.patch(`/orders/${order_id}/cancel`);
      alert('Order cancelled');
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Error cancelling order');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setReportProof(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if (!reportReason) return alert('Reason is required');
    try {
      await api.post('/reports', {
        order_id: reportModal.order.order_id,
        reported_user_id: reportModal.order.seller_id,
        reason: reportReason,
        proof_url: reportProof
      });
      alert('Report submitted successfully!');
      setReportModal({ show: false, order: null });
      setReportReason('');
      setReportProof('');
    } catch (err) {
      alert(err.response?.data?.message || 'Error submitting report');
    }
  };

  return (
    <>
      <Header cartCount={0} user={user} onLogout={logout} onOrdersClick={() => navigate('/orders')} onSellerClick={() => navigate('/seller')} />
      <div className="orders-container" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 className="text-gradient">My Orders</h2>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            onClick={() => switchTab('active')}
            className="auth-btn" 
            style={{ marginTop: 0, padding: '0.8rem 1.5rem', flex: 0, whiteSpace: 'nowrap', background: activeTab === 'active' ? 'var(--primary-color)' : 'rgba(0,0,0,0.3)', color: activeTab === 'active' ? '#000' : 'white', border: activeTab === 'active' ? 'none' : '1px solid var(--border-color)' }}
          >
            Active Orders
          </button>
          <button 
            onClick={() => switchTab('history')}
            className="auth-btn" 
            style={{ marginTop: 0, padding: '0.8rem 1.5rem', flex: 0, whiteSpace: 'nowrap', background: activeTab === 'history' ? 'var(--primary-color)' : 'rgba(0,0,0,0.3)', color: activeTab === 'history' ? '#000' : 'white', border: activeTab === 'history' ? 'none' : '1px solid var(--border-color)' }}
          >
            Order History
          </button>
        </div>
        
        <OrderFilters value={filters} onChange={setFilters} statusOptions={STATUSES_FOR_TAB[activeTab]} />

        {loading ? (
          <p style={{ opacity: 0.7 }}>Loading orders…</p>
        ) : orders.length === 0 ? (
          <p>{filters.status || filters.from || filters.to ? 'No orders match these filters.' : `No ${activeTab} orders found.`}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {orders.map(order => (
              <div key={order.order_id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ marginBottom: '0.5rem' }}>Order #{order.order_id} - {order.item_name}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {new Date(order.created_at).toLocaleString()}<br />
                    Seller: {order.seller_name} ({order.seller_phone})<br />
                    Quantity: {order.quantity} | Total: ₹{order.total_amount}<br />
                    Status: <strong style={{ color: order.order_status === 'Cancelled' ? 'var(--secondary-color)' : 'var(--primary-color)' }}>{order.order_status}</strong>
                  </p>
                  {order.my_rating && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                      Your rating: <StarRating value={order.my_rating} />
                      {order.my_review && <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{order.my_review}"</div>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button onClick={() => navigate(`/chat/${order.order_id}`)} className="auth-btn" style={{ marginTop: 0, padding: '0.5rem 1rem' }}>
                    Chat
                  </button>
                  {order.order_status === 'Placed' && (
                    <button onClick={() => handleCancel(order.order_id)} className="auth-btn" style={{ marginTop: 0, padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--secondary-color)', color: 'var(--secondary-color)' }}>
                      Cancel
                    </button>
                  )}
                  {order.order_status === 'Delivered' && !order.my_rating && (
                    <button onClick={() => openReview(order)} className="auth-btn" style={{ marginTop: 0, padding: '0.5rem 1rem', background: 'linear-gradient(90deg, #f1c40f, #f39c12)', color: '#000' }}>
                      Rate seller
                    </button>
                  )}
                  {activeTab === 'history' && (
                    <button onClick={() => setReportModal({ show: true, order })} className="auth-btn" style={{ marginTop: 0, padding: '0.5rem 1rem', background: 'var(--secondary-color)', color: 'white' }}>
                      Report
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '100%', maxWidth: '460px' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Rate {reviewModal.seller_name}</h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Order #{reviewModal.order_id} – {reviewModal.item_name}</p>
            {reviewError && <div className="auth-error" style={{ marginBottom: '1rem' }}>{reviewError}</div>}
            <form onSubmit={submitReview} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <StarRating value={reviewRating} onChange={setReviewRating} size={32} />
              <textarea
                placeholder="Anything other students should know? (optional)"
                maxLength={500}
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)', minHeight: '90px', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" className="auth-btn" style={{ flex: 1, marginTop: 0 }}>Submit rating</button>
                <button type="button" onClick={() => setReviewModal(null)} className="auth-btn" style={{ flex: 1, marginTop: 0, background: 'transparent', border: '1px solid var(--text-secondary)' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reportModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '90%', maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--secondary-color)' }}>Report Order #{reportModal.order.order_id}</h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Report Seller: {reportModal.order.seller_name}</p>
            <form onSubmit={submitReport} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <textarea 
                placeholder="Why are you reporting this? Please provide details." 
                required 
                value={reportReason} 
                onChange={e => setReportReason(e.target.value)}
                style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)', minHeight: '100px', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Attach Proof (Image)</label>
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ padding: '0.8rem', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="auth-btn" style={{ flex: 1, marginTop: 0, background: 'var(--secondary-color)' }}>Submit Report</button>
                <button type="button" onClick={() => { setReportModal({ show: false, order: null }); setReportReason(''); setReportProof(''); }} className="auth-btn" style={{ flex: 1, marginTop: 0, background: 'transparent', border: '1px solid var(--text-secondary)' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default MyOrdersPage;
