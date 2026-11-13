import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { BarChart3, Package, Users, Flag, ShieldCheck, LogOut, Building2, MessageSquare } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import ThemeToggle from '../components/ThemeToggle';
import EmptyState from '../components/EmptyState';
import AdminReportChat from '../components/AdminReportChat';
import AdminHostels from '../components/AdminHostels';
import api from '../utils/api';

const AdminDashboard = () => {
  const [report, setReport] = useState([]);
  const [listings, setListings] = useState([]);
  const [students, setStudents] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [reportFilter, setReportFilter] = useState('Pending');
  const [proofModal, setProofModal] = useState(null); // { report_id, url } | null
  const [chatReport, setChatReport] = useState(null);  // report whose conversation is open
  const [admins, setAdmins] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });
  const [adminFormMsg, setAdminFormMsg] = useState({ text: '', type: '' });
  const [activeTab, setActiveTab] = useState('report');
  
  const { admin, logout } = useContext(AuthContext);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === 'report') {
        const res = await api.get('/admin/report');
        setReport(res.data);
      } else if (activeTab === 'listings') {
        const res = await api.get('/admin/listings');
        setListings(res.data);
      } else if (activeTab === 'students') {
        const res = await api.get('/admin/students');
        setStudents(res.data);
      } else if (activeTab === 'userReports') {
        const res = await api.get('/admin/reports');
        setUserReports(res.data);
      } else if (activeTab === 'admins') {
        const res = await api.get('/admin/admins');
        setAdmins(res.data);
      }
    } catch (err) {
      console.error('Error fetching admin data', err);
    }
  };

  const handleRemoveListing = async (listing) => {
    if (!window.confirm(`Remove "${listing.item_name}" listed by ${listing.seller_name}?`)) return;
    try {
      await api.delete(`/admin/listings/${listing.listing_id}`);
      toast('Listing removed.');
      fetchData();
    } catch (err) {
      toast(err.response?.data?.message || 'Error removing listing', 'error');
    }
  };

  const handleToggleBan = async (student) => {
    const action = student.is_banned ? 'unban' : 'ban';
    const question = action === 'ban'
      ? `Ban ${student.name}? They will be logged out immediately and their listings hidden.`
      : `Unban ${student.name}?`;
    if (!window.confirm(question)) return;
    try {
      await api.patch(`/admin/students/${student.student_id}/${action}`);
      toast(action === 'ban' ? `${student.name} banned.` : `${student.name} unbanned.`);
      fetchData();
    } catch (err) {
      toast(err.response?.data?.message || `Error trying to ${action} student`, 'error');
    }
  };

  const handleReportStatus = async (report_id, status) => {
    try {
      await api.patch(`/admin/reports/${report_id}`, { status });
      fetchData();
    } catch (err) {
      toast(err.response?.data?.message || 'Error updating report', 'error');
    }
  };

  const handleBanFromReport = async (r) => {
    const action = r.reported_is_banned ? 'unban' : 'ban';
    if (!window.confirm(`${action === 'ban' ? 'Ban' : 'Unban'} ${r.reported_name}?`)) return;
    try {
      await api.patch(`/admin/students/${r.reported_user_id}/${action}`);
      fetchData();
    } catch (err) {
      toast(err.response?.data?.message || `Error trying to ${action} student`, 'error');
    }
  };

  const handleViewProof = async (report_id) => {
    try {
      const res = await api.get(`/admin/reports/${report_id}/proof`);
      setProofModal({ report_id, url: res.data.proof_url });
    } catch (err) {
      toast(err.response?.data?.message || 'Error loading proof', 'error');
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setAdminFormMsg({ text: '', type: '' });
    try {
      const res = await api.post('/admin/register', newAdmin);
      setAdminFormMsg({ text: res.data.message, type: 'success' });
      setNewAdmin({ name: '', email: '', password: '' });
      fetchData();
    } catch (err) {
      setAdminFormMsg({ text: err.response?.data?.message || 'Error creating admin', type: 'error' });
    }
  };

  const pendingCount = userReports.filter(r => r.status === 'Pending').length;
  const visibleReports = reportFilter === 'All' ? userReports : userReports.filter(r => r.status === reportFilter);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      <header style={{ background: 'var(--header-bg)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 50, padding: '1rem clamp(1rem, 4vw, 2rem)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
        <h1 style={{ fontSize: 'clamp(1.4rem, 5vw, 1.8rem)', fontWeight: 800, letterSpacing: '-0.06em' }}>jhapto<span style={{ color: 'var(--primary-color)' }}>.</span> <span style={{ fontWeight: 600, fontSize: '0.6em', letterSpacing: 0, color: 'var(--text-secondary)' }}>admin</span></h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold' }}>{admin?.name || admin?.email}</span>
          <ThemeToggle />
          <button onClick={handleLogout} className="btn btn-ghost btn-sm"><LogOut size={15} /> Log out</button>
        </div>
      </header>

      <div className="admin-layout">
        <nav className="glass-panel admin-sidebar" aria-label="Admin sections">
          {[
            ['report', 'Financial report', BarChart3],
            ['listings', 'Listings', Package],
            ['students', 'Students', Users],
            ['userReports', 'User reports', Flag],
            ['hostels', 'Hostels', Building2],
            ['admins', 'Admins', ShieldCheck],
          ].map(([key, label, Icon]) => (
            <button key={key} className="admin-tab" aria-current={activeTab === key ? 'page' : undefined} onClick={() => setActiveTab(key)}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>

        <div className="glass-panel admin-content">
          {activeTab === 'report' && (
            <div>
              <h2 className="section-heading">Seller Revenue Report</h2>
              <p style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Earned = delivered orders. Pending = placed or confirmed, not yet delivered.
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Floor</th>
                    <th>Listings</th>
                    <th>Orders Bought</th>
                    <th>Earned</th>
                    <th>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map(r => (
                    <tr key={r.student_id}>
                      <td>
                        {r.student_name}
                        {Boolean(r.is_banned) && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--secondary-color)' }}>Banned</span>}
                      </td>
                      <td>{r.floor_number}</td>
                      <td>{r.total_listings}</td>
                      <td>{r.total_orders}</td>
                      <td style={{ padding: '1rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>₹{r.total_revenue}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>₹{r.pending_revenue ?? '0.00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'listings' && (
            <div>
              <h2 className="section-heading">Platform Listings</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Seller</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map(l => (
                    <tr key={l.listing_id}>
                      <td>{l.item_name}</td>
                      <td>{l.seller_name}</td>
                      <td>
                        ₹{l.selling_price}
                        {!l.price_is_valid && <span style={{ color: 'var(--secondary-color)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>(Invalid)</span>}
                      </td>
                      <td><StatusBadge status={l.listing_status} /></td>
                      <td>
                        {l.listing_status !== 'Removed' && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemoveListing(l)}>Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'students' && (
            <div>
              <h2 className="section-heading">Registered Students</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.student_id}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>{s.phone_no}</td>
                      <td><StatusBadge status={s.is_banned ? 'Banned' : 'Active'} /></td>
                      <td>
                        <button className={`btn btn-sm ${s.is_banned ? 'btn-secondary' : 'btn-danger'}`} onClick={() => handleToggleBan(s)}>
                          {s.is_banned ? 'Unban' : 'Ban'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'userReports' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 className="section-heading" style={{ margin: 0 }}>User reports</h2>
                <div className="tabs" role="tablist" aria-label="Report status">
                  {['Pending', 'Resolved', 'Dismissed', 'All'].map(f => (
                    <button key={f} type="button" role="tab" className="tab" aria-selected={reportFilter === f} onClick={() => setReportFilter(f)}>
                      {f}{f === 'Pending' && pendingCount > 0 && <span className="tab-count">{pendingCount}</span>}
                    </button>
                  ))}
                </div>
              </div>
              {visibleReports.length === 0 ? (
                <p style={{ opacity: 0.7 }}>No {reportFilter === 'All' ? '' : reportFilter.toLowerCase() + ' '}reports.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Order</th>
                      <th>Reported by</th>
                      <th>Against</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleReports.map(r => (
                      <tr key={r.report_id}>
                        <td>{new Date(r.created_at).toLocaleString()}</td>
                        <td>#{r.order_id}</td>
                        <td>{r.reporter_name}<div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{r.reporter_email}</div></td>
                        <td>
                          {r.reported_name}
                          <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{r.reported_email}</div>
                          {Boolean(r.reported_is_banned) && <div style={{ fontSize: '0.8rem', color: 'var(--secondary-color)' }}>Banned</div>}
                        </td>
                        <td style={{ maxWidth: '280px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                          {r.reason}
                          {Boolean(r.has_proof) && (
                            <div><button className="btn btn-ghost btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => handleViewProof(r.report_id)}>View proof</button></div>
                          )}
                        </td>
                        <td><StatusBadge status={r.status} /></td>
                        <td>
                          {r.status === 'Pending' ? (
                            <>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleReportStatus(r.report_id, 'Resolved')}>Resolve</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => handleReportStatus(r.report_id, 'Dismissed')}>Dismiss</button>
                            </>
                          ) : (
                            <button className="btn btn-ghost btn-sm" onClick={() => handleReportStatus(r.report_id, 'Pending')}>Reopen</button>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => setChatReport(r)}>
                            <MessageSquare size={14} /> {Number(r.message_count) > 0 ? `Chat (${r.message_count})` : 'Message'}
                            {r.last_sender === 'student' && <span className="tab-count" title="Waiting for an admin reply">new</span>}
                          </button>
                          <button className={`btn btn-sm ${r.reported_is_banned ? 'btn-secondary' : 'btn-danger'}`} onClick={() => handleBanFromReport(r)}>
                            {r.reported_is_banned ? 'Unban user' : 'Ban user'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'hostels' && <AdminHostels />}

          {activeTab === 'admins' && (
            <div>
              <h2 className="section-heading">Admins</h2>
              <table className="table" style={{ marginBottom: '2rem' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(a => (
                    <tr key={a.admin_id}>
                      <td>{a.name}</td>
                      <td>{a.email}</td>
                      <td>{new Date(a.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="section-heading">Add an admin</h3>
              {adminFormMsg.text && (
                <div className={`alert ${adminFormMsg.type === 'error' ? 'alert-error' : 'alert-success'}`} role="status" style={{ marginBottom: '1rem', maxWidth: 420 }}>{adminFormMsg.text}</div>
              )}
              <form onSubmit={handleCreateAdmin} className="stack" style={{ maxWidth: 420, gap: '0.8rem' }}>
                <label className="field"><span>Name</span>
                  <input className="input" type="text" required maxLength={100} value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} />
                </label>
                <label className="field"><span>Email</span>
                  <input className="input" type="email" required value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} />
                </label>
                <label className="field"><span>Password</span>
                  <input className="input" type="password" required minLength={8} autoComplete="new-password" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} />
                  <span className="field-hint">At least 8 characters</span>
                </label>
                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Create admin</button>
              </form>
            </div>
          )}
        </div>
      </div>

      {chatReport && (
        <AdminReportChat report={chatReport} onClose={() => { setChatReport(null); fetchData(); }} />
      )}

      {proofModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setProofModal(null)}>
          <div onClick={(e) => e.stopPropagation()} className="modal" style={{ maxWidth: 'min(90vw, 900px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong>Proof for report #{proofModal.report_id}</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => setProofModal(null)}>Close</button>
            </div>
            {proofModal.url
              ? <img src={proofModal.url} alt="Report proof" style={{ maxWidth: '100%', maxHeight: '75vh', display: 'block' }} />
              : <p>No proof attached.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
