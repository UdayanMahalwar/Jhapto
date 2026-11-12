import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageCircle, Package, Star, Flag, X } from 'lucide-react';
import Header from '../components/Header';
import { AuthContext } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api from '../utils/api';
import OrderFilters from '../components/OrderFilters';
import OrderCard from '../components/OrderCard';
import Tabs from '../components/Tabs';
import EmptyState from '../components/EmptyState';
import ReportDialog from '../components/ReportDialog';
import RateDialog from '../components/RateDialog';
import { STATUSES_FOR_TAB, EMPTY_FILTERS, orderFilterParams } from '../utils/orderFilters';

const MyOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  // Tab lives in the URL (?tab=history) so notifications can link straight to it
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'history' ? 'history' : 'active';
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(null);   // order being reported
  const [rating, setRating] = useState(null);         // order being rated
  const { user, logout } = useContext(AuthContext);
  const toast = useToast();
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
    setSearchParams(tab === 'history' ? { tab: 'history' } : {}, { replace: true });
    setFilters(EMPTY_FILTERS);
  };

  const handleCancel = async (order_id) => {
    if (!window.confirm('Cancel this order? The seller will be notified.')) return;
    try {
      await api.patch(`/orders/${order_id}/cancel`);
      toast('Order cancelled');
      fetchOrders();
    } catch (err) {
      toast(err.response?.data?.message || 'Error cancelling order', 'error');
    }
  };

  const filtered = filters.status || filters.from || filters.to;

  return (
    <>
      <Header user={user} onLogout={logout} onOrdersClick={() => navigate('/orders')} onSellerClick={() => navigate('/seller')} />
      <main className="page page-narrow">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Orders</h1>
            <p className="page-subtitle">Things you've bought from other students.</p>
          </div>
          <Tabs
            label="Order status"
            value={activeTab}
            onChange={switchTab}
            items={[{ key: 'active', label: 'Active' }, { key: 'history', label: 'History' }]}
          />
        </div>

        <OrderFilters value={filters} onChange={setFilters} statusOptions={STATUSES_FOR_TAB[activeTab]} />

        {loading ? (
          <p className="muted">Loading orders…</p>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Package size={22} />}
            title={filtered ? 'No orders match these filters' : activeTab === 'active' ? 'No active orders' : 'No past orders yet'}
            text={filtered ? 'Try clearing the filters.' : activeTab === 'active' ? 'Orders you place show up here until they are delivered.' : 'Delivered and cancelled orders will appear here.'}
            action={!filtered && <button className="btn btn-primary" onClick={() => navigate('/')}>Browse listings</button>}
          />
        ) : (
          <div className="stack">
            {orders.map(order => (
              <OrderCard key={order.order_id} order={order} role="buyer">
                {order.order_status !== 'Cancelled' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/chat/${order.order_id}`)}>
                    <MessageCircle size={15} /> Chat
                  </button>
                )}
                {order.order_status === 'Delivered' && !order.my_rating && (
                  <button className="btn btn-primary btn-sm" onClick={() => setRating(order)}>
                    <Star size={15} /> Rate seller
                  </button>
                )}
                {order.order_status === 'Placed' && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleCancel(order.order_id)}>
                    <X size={15} /> Cancel order
                  </button>
                )}
                {activeTab === 'history' && (
                  <button className="btn btn-link danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setReporting(order)}>
                    <Flag size={14} /> Report
                  </button>
                )}
              </OrderCard>
            ))}
          </div>
        )}
      </main>

      {rating && (
        <RateDialog order={rating} onClose={() => setRating(null)} onSaved={() => { setRating(null); toast('Thanks for rating!'); fetchOrders(); }} />
      )}
      {reporting && (
        <ReportDialog
          order={reporting}
          reportedUserId={reporting.seller_id}
          reportedName={reporting.seller_name}
          roleLabel="Seller"
          onClose={() => setReporting(null)}
        />
      )}
    </>
  );
};

export default MyOrdersPage;
