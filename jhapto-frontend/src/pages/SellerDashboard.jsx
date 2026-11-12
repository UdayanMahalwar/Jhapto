import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';
import { uploadImage } from '../utils/upload';
import OrderFilters from '../components/OrderFilters';
import StarRating from '../components/StarRating';
import { STATUSES_FOR_TAB, EMPTY_FILTERS, orderFilterParams } from '../utils/orderFilters';

const fieldStyle = { padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)' };

const SellerDashboard = () => {
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [activeOrderTab, setActiveOrderTab] = useState('active'); // 'active' or 'history'
  const [reportModal, setReportModal] = useState({ show: false, order: null });
  const [reportReason, setReportReason] = useState('');
  const [reportProof, setReportProof] = useState('');
  const [newListing, setNewListing] = useState({ item_id: '', mrp: '', selling_price: '', quantity_available: '', description: '', room_number: '' });
  const [orderFilters, setOrderFilters] = useState(EMPTY_FILTERS);
  const [editListing, setEditListing] = useState(null); // form state for the listing being edited
  const [editError, setEditError] = useState('');
  const [uploading, setUploading] = useState(false);

  // Uploads the picked image and passes its URL to onDone; clears the picker on failure
  const pickImage = async (e, onDone, onError) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      onDone(await uploadImage(file));
    } catch (err) {
      e.target.value = '';
      onError(err.message);
    } finally {
      setUploading(false);
    }
  };
  
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [notification, setNotification] = useState({ message: '', type: '' });

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), 3000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrderTab, orderFilters]);

  const fetchData = async () => {
    try {
      const [listRes, itemsRes] = await Promise.all([
        api.get('/listings/my'),
        api.get('/listings/items')
      ]);
      setListings(listRes.data);
      setItems(itemsRes.data);
      if (itemsRes.data.length > 0) {
        setNewListing(prev => ({ ...prev, item_id: prev.item_id || itemsRes.data[0].item_id }));
      }
    } catch (err) {
      console.error('Error fetching seller data', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders/selling', { params: orderFilterParams(activeOrderTab, orderFilters) });
      setOrders(res.data);
    } catch (err) {
      console.error('Error fetching orders', err);
    }
  };

  const switchOrderTab = (tab) => {
    setActiveOrderTab(tab);
    setOrderFilters(EMPTY_FILTERS);
  };

  const openEdit = (l) => {
    setEditError('');
    setEditListing({
      listing_id: l.listing_id,
      item_name: l.item_name,
      mrp: String(l.mrp),
      selling_price: String(l.selling_price),
      quantity_available: String(l.quantity_available),
      description: l.description || '',
      room_number: l.room_number || '',
      photo_url: undefined, // unchanged unless a new photo is picked
    });
  };

  const handleEditPhoto = (e) => pickImage(e,
    (url) => setEditListing(prev => ({ ...prev, photo_url: url })),
    setEditError);

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    const { listing_id, item_name, photo_url, ...fields } = editListing;
    if (photo_url !== undefined) fields.photo_url = photo_url;
    try {
      const res = await api.patch(`/listings/${listing_id}`, fields);
      showNotification(res.data.listing_status === 'OutOfStock' ? 'Listing saved (out of stock)' : 'Listing updated');
      setEditListing(null);
      fetchData();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Error updating listing');
    }
  };

  const handleAddListing = async (e) => {
    e.preventDefault();
    try {
      await api.post('/listings', newListing);
      showNotification('Listing created successfully!');
      setNewListing({ item_id: items[0]?.item_id || '', mrp: '', selling_price: '', quantity_available: '', description: '', photo_url: '', room_number: '' });
      fetchData();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Error creating listing', 'error');
    }
  };

  const handleDeleteListing = async (id) => {
    if (!window.confirm('Remove listing?')) return;
    try {
      await api.delete(`/listings/${id}`);
      showNotification('Listing removed');
      fetchData();
    } catch (err) {
      showNotification('Error removing listing', 'error');
    }
  };

  const handleUpdateOrder = async (order_id, action) => {
    try {
      await api.patch(`/orders/${order_id}/${action}`);
      showNotification(`Order ${action}ed!`);
      fetchOrders();
      fetchData();
    } catch (err) {
      showNotification(err.response?.data?.message || `Error updating order`, 'error');
    }
  };

  const handleFileChange = (e) => pickImage(e,
    (url) => setNewListing(prev => ({ ...prev, photo_url: url })),
    (msg) => showNotification(msg, 'error'));

  const handleReportFileChange = (e) => pickImage(e, setReportProof, (msg) => alert(msg));

  const submitReport = async (e) => {
    e.preventDefault();
    if (!reportReason) return alert('Reason is required');
    try {
      await api.post('/reports', {
        order_id: reportModal.order.order_id,
        reported_user_id: reportModal.order.buyer_id,
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
      
      {notification.message && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: notification.type === 'error' ? 'var(--secondary-color)' : 'var(--primary-color)',
          color: notification.type === 'error' ? 'white' : 'black',
          padding: '1rem 2rem', borderRadius: '30px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          {notification.message}
        </div>
      )}
      
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* LEFT COLUMN: Manage Listings */}
        <div>
          <h2 className="text-gradient" style={{ marginBottom: '1.5rem' }}>Seller Dashboard</h2>
          
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Add New Listing</h3>
            <form onSubmit={handleAddListing} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <select 
                value={newListing.item_id} 
                onChange={(e) => setNewListing({...newListing, item_id: e.target.value})}
                style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)' }}
              >
                {items.map(item => <option key={item.item_id} value={item.item_id}>{item.item_name} ({item.brand})</option>)}
              </select>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input type="number" placeholder="MRP" required value={newListing.mrp} onChange={(e) => setNewListing({...newListing, mrp: e.target.value})} style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)' }} />
                <input type="number" placeholder="Selling Price" required value={newListing.selling_price} onChange={(e) => setNewListing({...newListing, selling_price: e.target.value})} style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)' }} />
              </div>
              <input type="number" placeholder="Quantity Available" required value={newListing.quantity_available} onChange={(e) => setNewListing({...newListing, quantity_available: e.target.value})} style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)' }} />
              <input type="text" placeholder="Room Number (e.g., K-204)" required value={newListing.room_number} onChange={(e) => setNewListing({...newListing, room_number: e.target.value})} style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)' }} />
              <input type="text" placeholder="Description (Optional)" value={newListing.description} onChange={(e) => setNewListing({...newListing, description: e.target.value})} style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Product Photo (Take a picture or upload)</label>
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" capture="environment" onChange={handleFileChange} style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)' }} />
                {uploading && <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>Uploading…</span>}
              </div>

              <button type="submit" disabled={uploading} className="auth-btn" style={{ marginTop: 0, opacity: uploading ? 0.6 : 1 }}>Add Listing</button>
            </form>
          </div>

          <h3>My Listings</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {listings.map(l => (
              <div key={l.listing_id} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4>{l.item_name}</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Price: ₹{l.selling_price} | Stock: {l.quantity_available} | Status: {l.listing_status}{l.room_number ? ` | Room ${l.room_number}` : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {l.listing_status !== 'Removed' && (
                    <button onClick={() => openEdit(l)} style={{ background: 'transparent', color: 'var(--primary-color)', border: 'none', cursor: 'pointer' }}>
                      {l.listing_status === 'OutOfStock' ? 'Restock' : 'Edit'}
                    </button>
                  )}
                  {l.listing_status === 'Active' && (
                    <button onClick={() => handleDeleteListing(l.listing_id)} style={{ background: 'transparent', color: 'var(--secondary-color)', border: 'none', cursor: 'pointer' }}>Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Received Orders */}
        <div>
          <h2 style={{ marginBottom: '1.5rem' }}>Received Orders</h2>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <button 
              onClick={() => switchOrderTab('active')}
              className="auth-btn" 
              style={{ marginTop: 0, padding: '0.6rem 1rem', flex: 0, whiteSpace: 'nowrap', background: activeOrderTab === 'active' ? 'var(--primary-color)' : 'rgba(0,0,0,0.3)', color: activeOrderTab === 'active' ? '#000' : 'white', border: activeOrderTab === 'active' ? 'none' : '1px solid var(--border-color)' }}
            >
              Active Orders
            </button>
            <button 
              onClick={() => switchOrderTab('history')}
              className="auth-btn" 
              style={{ marginTop: 0, padding: '0.6rem 1rem', flex: 0, whiteSpace: 'nowrap', background: activeOrderTab === 'history' ? 'var(--primary-color)' : 'rgba(0,0,0,0.3)', color: activeOrderTab === 'history' ? '#000' : 'white', border: activeOrderTab === 'history' ? 'none' : '1px solid var(--border-color)' }}
            >
              Order History
            </button>
          </div>

          <OrderFilters value={orderFilters} onChange={setOrderFilters} statusOptions={STATUSES_FOR_TAB[activeOrderTab]} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {orders.map(o => (
              <div key={o.order_id} className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h4 style={{ color: 'var(--primary-color)' }}>Order #{o.order_id}</h4>
                  <span style={{ fontWeight: 'bold' }}>{o.order_status}</span>
                </div>
                <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{new Date(o.created_at).toLocaleString()}</span><br />
                  Buyer: {o.buyer_name} ({o.buyer_phone})<br />
                  Item: {o.item_name} x{o.quantity}<br />
                  Total: ₹{o.total_amount}
                </p>
                {o.buyer_rating && (
                  <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                    Buyer rated you: <StarRating value={o.buyer_rating} />
                    {o.buyer_review && <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{o.buyer_review}"</div>}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {o.order_status === 'Placed' && <button onClick={() => handleUpdateOrder(o.order_id, 'confirm')} className="auth-btn" style={{ flex: 1, marginTop: 0, padding: '0.5rem' }}>Confirm</button>}
                  {o.order_status === 'Confirmed' && <button onClick={() => handleUpdateOrder(o.order_id, 'deliver')} className="auth-btn" style={{ flex: 1, marginTop: 0, padding: '0.5rem', background: 'linear-gradient(90deg, #00b09b, #96c93d)' }}>Mark Delivered</button>}
                  <button onClick={() => navigate(`/chat/${o.order_id}`)} className="auth-btn" style={{ flex: 1, marginTop: 0, padding: '0.5rem', background: 'transparent', border: '1px solid var(--primary-color)' }}>Chat</button>
                  {activeOrderTab === 'history' && (
                    <button onClick={() => setReportModal({ show: true, order: o })} className="auth-btn" style={{ flex: 1, marginTop: 0, padding: '0.5rem', background: 'var(--secondary-color)', color: 'white' }}>Report</button>
                  )}
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p>{orderFilters.status || orderFilters.from || orderFilters.to ? 'No orders match these filters.' : `No ${activeOrderTab} orders found.`}</p>
            )}
          </div>
        </div>

      </div>

      {editListing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>Edit: {editListing.item_name}</h3>
            {editError && <div className="auth-error" style={{ marginBottom: '1rem' }}>{editError}</div>}
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  MRP (₹)
                  <input type="number" min="0.01" step="0.01" required value={editListing.mrp} onChange={(e) => setEditListing({ ...editListing, mrp: e.target.value })} style={fieldStyle} />
                </label>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Selling price (₹)
                  <input type="number" min="0.01" step="0.01" required value={editListing.selling_price} onChange={(e) => setEditListing({ ...editListing, selling_price: e.target.value })} style={fieldStyle} />
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Quantity available (0 = out of stock)
                <input type="number" min="0" max="1000" step="1" required value={editListing.quantity_available} onChange={(e) => setEditListing({ ...editListing, quantity_available: e.target.value })} style={fieldStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Room number
                <input type="text" required maxLength={50} value={editListing.room_number} onChange={(e) => setEditListing({ ...editListing, room_number: e.target.value })} style={fieldStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Description
                <input type="text" maxLength={500} value={editListing.description} onChange={(e) => setEditListing({ ...editListing, description: e.target.value })} style={fieldStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Replace photo (optional)
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleEditPhoto} style={fieldStyle} />
                {uploading && <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>Uploading…</span>}
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" disabled={uploading} className="auth-btn" style={{ flex: 1, marginTop: 0, opacity: uploading ? 0.6 : 1 }}>Save changes</button>
                <button type="button" onClick={() => setEditListing(null)} className="auth-btn" style={{ flex: 1, marginTop: 0, background: 'transparent', border: '1px solid var(--text-secondary)' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reportModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '90%', maxWidth: '500px' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--secondary-color)' }}>Report Order #{reportModal.order.order_id}</h3>
            <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Report Buyer: {reportModal.order.buyer_name}</p>
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
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleReportFileChange} style={{ padding: '0.8rem', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)' }} />
                {uploading && <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>Uploading…</span>}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" disabled={uploading} className="auth-btn" style={{ flex: 1, marginTop: 0, background: 'var(--secondary-color)', opacity: uploading ? 0.6 : 1 }}>Submit Report</button>
                <button type="button" onClick={() => { setReportModal({ show: false, order: null }); setReportReason(''); setReportProof(''); }} className="auth-btn" style={{ flex: 1, marginTop: 0, background: 'transparent', border: '1px solid var(--text-secondary)' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SellerDashboard;
