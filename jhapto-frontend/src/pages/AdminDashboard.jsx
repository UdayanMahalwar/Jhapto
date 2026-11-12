import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';

const AdminDashboard = () => {
  const [report, setReport] = useState([]);
  const [listings, setListings] = useState([]);
  const [students, setStudents] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [reportFilter, setReportFilter] = useState('Pending');
  const [proofModal, setProofModal] = useState(null); // { report_id, url } | null
  const [admins, setAdmins] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });
  const [adminFormMsg, setAdminFormMsg] = useState({ text: '', type: '' });
  const [activeTab, setActiveTab] = useState('report');
  
  const { admin, logout } = useContext(AuthContext);
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

  const handleRemoveListing = async (id) => {
    try {
      console.log('Removing listing:', id);
      await api.delete(`/admin/listings/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Error removing listing');
    }
  };

  const handleToggleBan = async (student) => {
    const action = student.is_banned ? 'unban' : 'ban';
    try {
      console.log(`Toggling ban for student ${student.student_id}, action: ${action}`);
      await api.patch(`/admin/students/${student.student_id}/${action}`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(`Error trying to ${action} student`);
    }
  };

  const handleReportStatus = async (report_id, status) => {
    try {
      await api.patch(`/admin/reports/${report_id}`, { status });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error updating report');
    }
  };

  const handleBanFromReport = async (r) => {
    const action = r.reported_is_banned ? 'unban' : 'ban';
    if (!window.confirm(`${action === 'ban' ? 'Ban' : 'Unban'} ${r.reported_name}?`)) return;
    try {
      await api.patch(`/admin/students/${r.reported_user_id}/${action}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || `Error trying to ${action} student`);
    }
  };

  const handleViewProof = async (report_id) => {
    try {
      const res = await api.get(`/admin/reports/${report_id}/proof`);
      setProofModal({ report_id, url: res.data.proof_url });
    } catch (err) {
      alert(err.response?.data?.message || 'Error loading proof');
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

  const tabButtonStyle = (tab) => ({ padding: '1rem', background: activeTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', borderRadius: '8px' });
  const cell = { padding: '1rem', verticalAlign: 'top' };
  const smallBtn = (bg) => ({ padding: '0.4rem 0.8rem', background: bg, border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', marginRight: '0.4rem', marginBottom: '0.4rem' });
  const inputStyle = { padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)' };
  const pendingCount = userReports.filter(r => r.status === 'Pending').length;
  const visibleReports = reportFilter === 'All' ? userReports : userReports.filter(r => r.status === reportFilter);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', color: 'white' }}>
      <header className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
        <h1 className="text-gradient" style={{ background: 'linear-gradient(90deg, #ff9a9e, #fecfef)' }}>JHAPTO ADMIN</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold' }}>{admin?.name || admin?.email}</span>
          <button onClick={handleLogout} className="auth-btn" style={{ padding: '0.5rem 1rem', marginTop: 0, background: 'transparent', border: '1px solid var(--secondary-color)', color: 'var(--secondary-color)' }}>Logout</button>
        </div>
      </header>

      <div style={{ display: 'flex', padding: '2rem', gap: '2rem' }}>
        <div className="glass-panel" style={{ width: '250px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignSelf: 'flex-start' }}>
          <button onClick={() => setActiveTab('report')} style={{ padding: '1rem', background: activeTab==='report' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', borderRadius: '8px' }}>Financial Report</button>
          <button onClick={() => setActiveTab('listings')} style={{ padding: '1rem', background: activeTab==='listings' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', borderRadius: '8px' }}>Manage Listings</button>
          <button onClick={() => setActiveTab('students')} style={{ padding: '1rem', background: activeTab==='students' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', borderRadius: '8px' }}>Manage Students</button>
          <button onClick={() => setActiveTab('userReports')} style={tabButtonStyle('userReports')}>User Reports</button>
          <button onClick={() => setActiveTab('admins')} style={tabButtonStyle('admins')}>Admins</button>
        </div>

        <div className="glass-panel" style={{ flex: 1, padding: '2rem', overflowX: 'auto' }}>
          {activeTab === 'report' && (
            <div>
              <h2 style={{ marginBottom: '1rem' }}>Seller Revenue Report</h2>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem' }}>Student</th>
                    <th style={{ padding: '1rem' }}>Floor</th>
                    <th style={{ padding: '1rem' }}>Listings</th>
                    <th style={{ padding: '1rem' }}>Orders Bought</th>
                    <th style={{ padding: '1rem' }}>Total Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map(r => (
                    <tr key={r.student_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem' }}>{r.student_name}</td>
                      <td style={{ padding: '1rem' }}>{r.floor_number}</td>
                      <td style={{ padding: '1rem' }}>{r.total_listings}</td>
                      <td style={{ padding: '1rem' }}>{r.total_orders}</td>
                      <td style={{ padding: '1rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>₹{r.total_revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'listings' && (
            <div>
              <h2 style={{ marginBottom: '1rem' }}>Platform Listings</h2>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem' }}>Item</th>
                    <th style={{ padding: '1rem' }}>Seller</th>
                    <th style={{ padding: '1rem' }}>Price</th>
                    <th style={{ padding: '1rem' }}>Status</th>
                    <th style={{ padding: '1rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map(l => (
                    <tr key={l.listing_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem' }}>{l.item_name}</td>
                      <td style={{ padding: '1rem' }}>{l.seller_name}</td>
                      <td style={{ padding: '1rem' }}>
                        ₹{l.selling_price}
                        {!l.price_is_valid && <span style={{ color: 'var(--secondary-color)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>(Invalid)</span>}
                      </td>
                      <td style={{ padding: '1rem' }}>{l.listing_status}</td>
                      <td style={{ padding: '1rem' }}>
                        {l.listing_status !== 'Removed' && (
                          <button onClick={() => handleRemoveListing(l.listing_id)} style={{ padding: '0.4rem 0.8rem', background: 'var(--secondary-color)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Remove</button>
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
              <h2 style={{ marginBottom: '1rem' }}>Registered Students</h2>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem' }}>Name</th>
                    <th style={{ padding: '1rem' }}>Email</th>
                    <th style={{ padding: '1rem' }}>Phone</th>
                    <th style={{ padding: '1rem' }}>Status</th>
                    <th style={{ padding: '1rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.student_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem' }}>{s.name}</td>
                      <td style={{ padding: '1rem' }}>{s.email}</td>
                      <td style={{ padding: '1rem' }}>{s.phone_no}</td>
                      <td style={{ padding: '1rem', color: s.is_banned ? 'var(--secondary-color)' : '#96c93d' }}>
                        {s.is_banned ? 'Banned' : 'Active'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button 
                          onClick={() => handleToggleBan(s)} 
                          style={{ padding: '0.4rem 0.8rem', background: s.is_banned ? '#96c93d' : 'var(--secondary-color)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
                        >
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
                <h2>User Reports {pendingCount > 0 && <span style={{ fontSize: '0.9rem', color: 'var(--secondary-color)' }}>({pendingCount} pending)</span>}</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['Pending', 'Resolved', 'Dismissed', 'All'].map(f => (
                    <button key={f} onClick={() => setReportFilter(f)} style={{ ...smallBtn(reportFilter === f ? 'var(--secondary-color)' : 'rgba(255,255,255,0.1)'), marginBottom: 0 }}>{f}</button>
                  ))}
                </div>
              </div>
              {visibleReports.length === 0 ? (
                <p style={{ opacity: 0.7 }}>No {reportFilter === 'All' ? '' : reportFilter.toLowerCase() + ' '}reports.</p>
              ) : (
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={cell}>Date</th>
                      <th style={cell}>Order</th>
                      <th style={cell}>Reported by</th>
                      <th style={cell}>Against</th>
                      <th style={cell}>Reason</th>
                      <th style={cell}>Status</th>
                      <th style={cell}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleReports.map(r => (
                      <tr key={r.report_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={cell}>{new Date(r.created_at).toLocaleString()}</td>
                        <td style={cell}>#{r.order_id}</td>
                        <td style={cell}>{r.reporter_name}<div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{r.reporter_email}</div></td>
                        <td style={cell}>
                          {r.reported_name}
                          <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{r.reported_email}</div>
                          {Boolean(r.reported_is_banned) && <div style={{ fontSize: '0.8rem', color: 'var(--secondary-color)' }}>Banned</div>}
                        </td>
                        <td style={{ ...cell, maxWidth: '280px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {r.reason}
                          {Boolean(r.has_proof) && (
                            <div><button onClick={() => handleViewProof(r.report_id)} style={{ ...smallBtn('rgba(255,255,255,0.15)'), marginTop: '0.5rem' }}>View proof</button></div>
                          )}
                        </td>
                        <td style={{ ...cell, color: r.status === 'Pending' ? '#f1c40f' : r.status === 'Resolved' ? '#96c93d' : 'rgba(255,255,255,0.6)' }}>{r.status}</td>
                        <td style={cell}>
                          {r.status === 'Pending' ? (
                            <>
                              <button onClick={() => handleReportStatus(r.report_id, 'Resolved')} style={smallBtn('#96c93d')}>Resolve</button>
                              <button onClick={() => handleReportStatus(r.report_id, 'Dismissed')} style={smallBtn('rgba(255,255,255,0.2)')}>Dismiss</button>
                            </>
                          ) : (
                            <button onClick={() => handleReportStatus(r.report_id, 'Pending')} style={smallBtn('rgba(255,255,255,0.2)')}>Reopen</button>
                          )}
                          <button onClick={() => handleBanFromReport(r)} style={smallBtn(r.reported_is_banned ? '#96c93d' : 'var(--secondary-color)')}>
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

          {activeTab === 'admins' && (
            <div>
              <h2 style={{ marginBottom: '1rem' }}>Admins</h2>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={cell}>Name</th>
                    <th style={cell}>Email</th>
                    <th style={cell}>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(a => (
                    <tr key={a.admin_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={cell}>{a.name}</td>
                      <td style={cell}>{a.email}</td>
                      <td style={cell}>{new Date(a.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 style={{ marginBottom: '1rem' }}>Add an admin</h3>
              {adminFormMsg.text && (
                <div style={{ marginBottom: '1rem', color: adminFormMsg.type === 'error' ? 'var(--secondary-color)' : '#96c93d' }}>{adminFormMsg.text}</div>
              )}
              <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxWidth: '400px' }}>
                <input type="text" placeholder="Name" required maxLength={100} value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} style={inputStyle} />
                <input type="email" placeholder="Email" required value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} style={inputStyle} />
                <input type="password" placeholder="Password (min 8 characters)" required minLength={8} value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} style={inputStyle} />
                <button type="submit" style={{ ...smallBtn('var(--secondary-color)'), padding: '0.8rem', marginRight: 0 }}>Create admin</button>
              </form>
            </div>
          )}
        </div>
      </div>

      {proofModal && (
        <div onClick={() => setProofModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem', cursor: 'pointer' }}>
          <div onClick={(e) => e.stopPropagation()} className="glass-panel" style={{ padding: '1rem', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong>Proof for report #{proofModal.report_id}</strong>
              <button onClick={() => setProofModal(null)} style={smallBtn('rgba(255,255,255,0.2)')}>Close</button>
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
