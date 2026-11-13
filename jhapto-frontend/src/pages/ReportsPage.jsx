import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Flag, MessageSquare } from 'lucide-react';
import Header from '../components/Header';
import StatusBadge from '../components/StatusBadge';
import ReportThread from '../components/ReportThread';
import EmptyState from '../components/EmptyState';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';

const POLL_MS = 10000;

// /reports — every report the student filed
const ReportList = () => {
  const [reports, setReports] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/reports/mine').then((r) => setReports(r.data)).catch(() => setReports([]));
  }, []);

  if (!reports) return <p className="muted">Loading…</p>;
  if (reports.length === 0) {
    return <EmptyState icon={<Flag size={22} />} title="No reports" text="If something goes wrong with an order, report it from your order history. You can talk to the admins about it here." />;
  }
  return (
    <div className="stack">
      {reports.map((r) => (
        <button key={r.report_id} className="card report-row" onClick={() => navigate(`/reports/${r.report_id}`)}>
          <div className="report-row-main">
            <div className="report-row-title">Report #{r.report_id} · {r.reported_name}</div>
            <div className="muted small report-row-reason">{r.reason}</div>
            <div className="muted small">
              Order #{r.order_id} · {new Date(r.created_at).toLocaleDateString()}
              {Number(r.message_count) > 0 && <> · <MessageSquare size={12} /> {r.message_count}</>}
            </div>
          </div>
          <div className="report-row-side">
            <StatusBadge status={r.status} />
            {r.last_sender === 'admin' && <span className="badge-pill badge-info">Admin replied</span>}
          </div>
        </button>
      ))}
    </div>
  );
};

// /reports/:id — the conversation with the admins
const ReportDetail = ({ id }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get(`/reports/${id}/messages`).then((r) => setData(r.data))
    .catch((err) => setError(err.response?.data?.message || 'Could not load this report.'));

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);   // admin replies show up without a refresh
    return () => clearInterval(t);
  }, [id]);

  if (error) return <div className="alert alert-error" role="alert">{error}</div>;
  if (!data) return <p className="muted">Loading…</p>;
  const { report, messages } = data;

  const send = async (text) => {
    const res = await api.post(`/reports/${id}/messages`, { message_text: text });
    setData((d) => ({ ...d, messages: [...d.messages, res.data.data] }));
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="report-detail-head">
          <div>
            <div className="report-row-title">You reported {report.reported_name}</div>
            <div className="muted small">Order #{report.order_id} · {new Date(report.created_at).toLocaleString()}</div>
          </div>
          <StatusBadge status={report.status} />
        </div>
        <p className="report-reason">{report.reason}</p>
      </div>
      <div className="card">
        <h2 className="section-heading">Conversation with the admins</h2>
        <ReportThread messages={messages} me="student" onSend={send}
          placeholder="Add details or answer the admins…"
          emptyText="No messages yet. Add anything that helps the admins — they'll reply here and you'll get an alert." />
      </div>
    </div>
  );
};

const ReportsPage = () => {
  const { id } = useParams();
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <>
      <Header user={user} onLogout={logout} onOrdersClick={() => navigate('/orders')} onSellerClick={() => navigate('/seller')} />
      <main className="page">
        <div className="page-header">
          <div>
            {id && (
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reports')} style={{ marginBottom: '0.5rem' }}>
                <ArrowLeft size={16} /> All reports
              </button>
            )}
            <h1 className="page-title">{id ? `Report #${id}` : 'My reports'}</h1>
            <p className="page-subtitle">{id ? 'Talk to the admins about this report.' : 'Reports you filed and the admins’ replies.'}</p>
          </div>
        </div>
        {id ? <ReportDetail key={id} id={id} /> : <ReportList />}
      </main>
    </>
  );
};

export default ReportsPage;
