import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, MessageCircle, PackageCheck, Flag, Store, Inbox, Pencil, Trash2, RotateCcw } from 'lucide-react';
import Header from '../components/Header';
import { AuthContext } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api from '../utils/api';
import { uploadImage } from '../utils/upload';
import OrderFilters from '../components/OrderFilters';
import OrderCard from '../components/OrderCard';
import Tabs from '../components/Tabs';
import EmptyState from '../components/EmptyState';
import FilePicker from '../components/FilePicker';
import StatusBadge from '../components/StatusBadge';
import ReportDialog from '../components/ReportDialog';
import { STATUSES_FOR_TAB, EMPTY_FILTERS, orderFilterParams } from '../utils/orderFilters';

const EMPTY_LISTING = { mrp: '', selling_price: '', quantity_available: '', description: '', photo_url: '' };

// "Max ₹21.00" helper under the price field (selling price may not exceed 1.5 × MRP)
const maxPrice = (mrp) => {
  const n = Number(mrp);
  return n > 0 ? `Max ₹${(Math.floor(n * 150) / 100).toFixed(2)} (1.5 × MRP)` : 'At most 1.5 × MRP';
};

const SellerDashboard = () => {
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [items, setItems] = useState([]);
  // Order tab lives in the URL (?tab=history) so notifications can link to it
  const [searchParams, setSearchParams] = useSearchParams();
  const activeOrderTab = searchParams.get('tab') === 'history' ? 'history' : 'active';
  const [photoInputKey, setPhotoInputKey] = useState(0);   // bump to reset the file picker
  const [newListing, setNewListing] = useState({ item_id: '', room_number: '', ...EMPTY_LISTING });
  const [creating, setCreating] = useState(false);
  const [orderFilters, setOrderFilters] = useState(EMPTY_FILTERS);
  const [editListing, setEditListing] = useState(null); // form state for the listing being edited
  const [editError, setEditError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [reporting, setReporting] = useState(null);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const toast = useToast();

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

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrderTab, orderFilters]);

  const fetchData = async () => {
    try {
      const [listRes, itemsRes, pendingRes] = await Promise.all([
        api.get('/listings/my'),
        api.get('/listings/items'),
        api.get('/orders/selling', { params: { status: 'Placed' } }),
      ]);
      setListings(listRes.data);
      setItems(itemsRes.data);
      setPendingCount(pendingRes.data.length);
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

  // Dropdown grouped by category: { 'Beverages': [items…], … }
  const itemsByCategory = useMemo(() => items.reduce((groups, item) => {
    (groups[item.category_name] = groups[item.category_name] || []).push(item);
    return groups;
  }, {}), [items]);

  const switchOrderTab = (tab) => {
    setSearchParams(tab === 'history' ? { tab: 'history' } : {}, { replace: true });
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
      current_photo: l.photo_url || '',
      photo_url: undefined, // unchanged unless a new photo is picked
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    // eslint-disable-next-line no-unused-vars
    const { listing_id, item_name, current_photo, photo_url, ...fields } = editListing;
    if (photo_url !== undefined) fields.photo_url = photo_url;
    try {
      const res = await api.patch(`/listings/${listing_id}`, fields);
      toast(res.data.listing_status === 'OutOfStock' ? 'Saved — marked out of stock' : 'Listing updated');
      setEditListing(null);
      fetchData();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Error updating listing');
    }
  };

  const handleAddListing = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/listings', newListing);
      toast('Listing is live!');
      // keep the item and room — sellers usually list several things from the same room
      setNewListing(prev => ({ ...prev, ...EMPTY_LISTING }));
      setPhotoInputKey(k => k + 1);
      fetchData();
    } catch (err) {
      toast(err.response?.data?.message || 'Error creating listing', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteListing = async (listing) => {
    if (!window.confirm(`Remove your "${listing.item_name}" listing? Buyers won't see it any more.`)) return;
    try {
      await api.delete(`/listings/${listing.listing_id}`);
      toast('Listing removed');
      fetchData();
    } catch (err) {
      toast(err.response?.data?.message || 'Error removing listing', 'error');
    }
  };

  const handleUpdateOrder = async (order_id, action) => {
    try {
      await api.patch(`/orders/${order_id}/${action}`);
      toast(action === 'confirm' ? 'Order confirmed — the buyer can now chat with you.' : 'Marked as delivered.');
      fetchOrders();
      fetchData();
    } catch (err) {
      toast(err.response?.data?.message || 'Error updating order', 'error');
    }
  };

  const set = (patch) => setNewListing(prev => ({ ...prev, ...patch }));
  const setEdit = (patch) => setEditListing(prev => ({ ...prev, ...patch }));
  const visibleListings = listings.filter(l => l.listing_status !== 'Removed');
  const removedCount = listings.length - visibleListings.length;
  const filtered = orderFilters.status || orderFilters.from || orderFilters.to;

  return (
    <>
      <Header user={user} onLogout={logout} onOrdersClick={() => navigate('/orders')} onSellerClick={() => navigate('/seller')} />

      <main className="page" style={{ maxWidth: 1200 }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Seller Dashboard</h1>
            <p className="page-subtitle">
              {pendingCount > 0
                ? <><strong style={{ color: 'var(--warning)' }}>{pendingCount} order{pendingCount > 1 ? 's' : ''}</strong> waiting for you to confirm.</>
                : 'List things you want to sell and manage incoming orders.'}
            </p>
          </div>
        </div>

        <div className="seller-grid" style={{ padding: 0 }}>
          {/* LEFT: add + manage listings */}
          <div className="stack" style={{ gap: '1.5rem' }}>
            <section className="card card-lg" aria-labelledby="add-listing">
              <h2 id="add-listing" className="section-heading">Sell something</h2>
              <form onSubmit={handleAddListing} className="stack">
                <label className="field">
                  <span>Item</span>
                  <select className="input" value={newListing.item_id} onChange={(e) => set({ item_id: e.target.value })}>
                    {Object.entries(itemsByCategory).map(([category, list]) => (
                      <optgroup key={category} label={category}>
                        {list.map(item => <option key={item.item_id} value={item.item_id}>{item.item_name} ({item.brand})</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>MRP (₹)</span>
                    <input className="input" type="number" min="0.01" step="0.01" inputMode="decimal" required placeholder="20.00"
                      value={newListing.mrp} onChange={(e) => set({ mrp: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Your price (₹)</span>
                    <input className="input" type="number" min="0.01" step="0.01" inputMode="decimal" required placeholder="22.00"
                      value={newListing.selling_price} onChange={(e) => set({ selling_price: e.target.value })} />
                    <span className="field-hint">{maxPrice(newListing.mrp)}</span>
                  </label>
                </div>
                <div className="field-row">
                  <label className="field">
                    <span>Quantity</span>
                    <input className="input" type="number" min="1" max="1000" step="1" inputMode="numeric" required placeholder="1"
                      value={newListing.quantity_available} onChange={(e) => set({ quantity_available: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Room number</span>
                    <input className="input" type="text" maxLength={50} required placeholder="K-204"
                      value={newListing.room_number} onChange={(e) => set({ room_number: e.target.value })} />
                  </label>
                </div>
                <label className="field">
                  <span>Description (optional)</span>
                  <input className="input" type="text" maxLength={500} placeholder="e.g. Sealed pack, bought yesterday"
                    value={newListing.description} onChange={(e) => set({ description: e.target.value })} />
                </label>
                <div className="field">
                  <span>Photo (optional)</span>
                  <FilePicker
                    inputKey={photoInputKey}
                    value={newListing.photo_url}
                    uploading={uploading && !editListing}
                    capture="environment"
                    label="Take or upload a photo"
                    onChange={(e) => pickImage(e, (url) => set({ photo_url: url }), (msg) => toast(msg, 'error'))}
                    onRemove={() => { set({ photo_url: '' }); setPhotoInputKey(k => k + 1); }}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block" disabled={uploading || creating}>
                  {creating ? 'Listing…' : 'List item'}
                </button>
              </form>
            </section>

            <section aria-labelledby="my-listings">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h2 id="my-listings" className="section-heading" style={{ margin: 0 }}>My listings</h2>
                {removedCount > 0 && <span className="muted small">{removedCount} removed hidden</span>}
              </div>
              {visibleListings.length === 0 ? (
                <EmptyState icon={<Store size={22} />} title="Nothing listed yet" text="Use the form above to put your first item up for sale." />
              ) : (
                <div className="stack" style={{ gap: '0.6rem' }}>
                  {visibleListings.map(l => (
                    <div key={l.listing_id} className="card listing-row">
                      {l.photo_url
                        ? <img className="listing-thumb" src={l.photo_url} alt="" />
                        : <div className="listing-thumb" aria-hidden="true">{l.item_name.charAt(0)}</div>}
                      <div className="listing-row-body">
                        <div className="row" style={{ gap: '0.5rem', flexWrap: 'nowrap' }}>
                          <span className="listing-row-name">{l.item_name}</span>
                          <StatusBadge status={l.listing_status} />
                        </div>
                        <div className="listing-row-facts">
                          <span>₹{Number(l.selling_price).toFixed(2)}</span>
                          <span>{l.quantity_available} in stock</span>
                          {l.room_number && <span>Room {l.room_number}</span>}
                        </div>
                      </div>
                      <div className="listing-row-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(l)} aria-label={`Edit ${l.item_name}`}>
                          {l.listing_status === 'OutOfStock' ? <><RotateCcw size={14} /> Restock</> : <><Pencil size={14} /> Edit</>}
                        </button>
                        <button className="btn btn-link danger btn-sm" onClick={() => handleDeleteListing(l)} aria-label={`Remove ${l.item_name}`}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT: received orders */}
          <section aria-labelledby="received-orders">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 id="received-orders" className="section-heading" style={{ margin: 0 }}>Received orders</h2>
              <Tabs
                label="Received orders"
                value={activeOrderTab}
                onChange={switchOrderTab}
                items={[{ key: 'active', label: 'Active', count: pendingCount }, { key: 'history', label: 'History' }]}
              />
            </div>

            <OrderFilters value={orderFilters} onChange={setOrderFilters} statusOptions={STATUSES_FOR_TAB[activeOrderTab]} />

            {orders.length === 0 ? (
              <EmptyState
                icon={<Inbox size={22} />}
                title={filtered ? 'No orders match these filters' : activeOrderTab === 'active' ? 'No orders to handle' : 'No past orders yet'}
                text={filtered ? 'Try clearing the filters.' : activeOrderTab === 'active' ? "When someone buys from you, it shows up here." : 'Delivered and cancelled orders will appear here.'}
              />
            ) : (
              <div className="stack">
                {orders.map(o => (
                  <OrderCard key={o.order_id} order={o} role="seller">
                    {o.order_status === 'Placed' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleUpdateOrder(o.order_id, 'confirm')}>
                        <Check size={15} /> Confirm order
                      </button>
                    )}
                    {o.order_status === 'Confirmed' && (
                      <button className="btn btn-success btn-sm" onClick={() => handleUpdateOrder(o.order_id, 'deliver')}>
                        <PackageCheck size={15} /> Mark delivered
                      </button>
                    )}
                    {o.order_status !== 'Cancelled' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/chat/${o.order_id}`)}>
                        <MessageCircle size={15} /> Chat
                      </button>
                    )}
                    {activeOrderTab === 'history' && (
                      <button className="btn btn-link danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setReporting(o)}>
                        <Flag size={14} /> Report
                      </button>
                    )}
                  </OrderCard>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {editListing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-title">
          <form className="modal stack" onSubmit={handleSaveEdit}>
            <div>
              <h3 id="edit-title" className="modal-title">Edit listing</h3>
              <p className="muted small">{editListing.item_name}</p>
            </div>
            {editError && <div className="alert alert-error" role="alert">{editError}</div>}
            <div className="field-row">
              <label className="field">
                <span>MRP (₹)</span>
                <input className="input" type="number" min="0.01" step="0.01" required value={editListing.mrp} onChange={(e) => setEdit({ mrp: e.target.value })} />
              </label>
              <label className="field">
                <span>Your price (₹)</span>
                <input className="input" type="number" min="0.01" step="0.01" required value={editListing.selling_price} onChange={(e) => setEdit({ selling_price: e.target.value })} />
                <span className="field-hint">{maxPrice(editListing.mrp)}</span>
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Quantity</span>
                <input className="input" type="number" min="0" max="1000" step="1" required value={editListing.quantity_available} onChange={(e) => setEdit({ quantity_available: e.target.value })} />
                <span className="field-hint">0 = out of stock</span>
              </label>
              <label className="field">
                <span>Room number</span>
                <input className="input" type="text" required maxLength={50} placeholder="K-204" value={editListing.room_number} onChange={(e) => setEdit({ room_number: e.target.value })} />
              </label>
            </div>
            <label className="field">
              <span>Description</span>
              <input className="input" type="text" maxLength={500} value={editListing.description} onChange={(e) => setEdit({ description: e.target.value })} />
            </label>
            <div className="field">
              <span>Photo</span>
              <FilePicker
                value={editListing.photo_url !== undefined ? editListing.photo_url : editListing.current_photo}
                uploading={uploading}
                label="Replace photo"
                onChange={(e) => pickImage(e, (url) => setEdit({ photo_url: url }), setEditError)}
                onRemove={() => setEdit({ photo_url: '' })}
              />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditListing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={uploading}>Save changes</button>
            </div>
          </form>
        </div>
      )}

      {reporting && (
        <ReportDialog
          order={reporting}
          reportedUserId={reporting.buyer_id}
          reportedName={reporting.buyer_name}
          roleLabel="Buyer"
          onClose={() => setReporting(null)}
        />
      )}
    </>
  );
};

export default SellerDashboard;
