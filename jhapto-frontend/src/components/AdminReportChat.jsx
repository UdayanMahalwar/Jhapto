import React, { useEffect, useState } from 'react';
import ReportThread from './ReportThread';
import api from '../utils/api';

// Admin side of a report's conversation, shown in a dialog
const AdminReportChat = ({ report, onClose, onSent }) => {
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () => api.get(`/admin/reports/${report.report_id}/messages`).then((r) => setMessages(r.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load messages.'));
    load();
    const t = setInterval(load, 10000);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { clearInterval(t); document.removeEventListener('keydown', onKey); };
  }, [report.report_id, onClose]);

  const send = async (text) => {
    const res = await api.post(`/admin/reports/${report.report_id}/messages`, { message_text: text });
    setMessages((m) => [...(m || []), res.data.data]);
    onSent?.();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="report-chat-title" onClick={onClose}>
      <div className="modal stack" style={{ maxWidth: 'min(94vw, 560px)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h3 id="report-chat-title" className="modal-title" style={{ margin: 0 }}>Report #{report.report_id}</h3>
            <div className="muted small">{report.reporter_name} reported {report.reported_name} · Order #{report.order_id}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <p className="report-reason" style={{ margin: 0 }}>{report.reason}</p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {messages === null ? <p className="muted">Loading…</p> : (
          <ReportThread messages={messages} me="admin" onSend={send}
            placeholder={`Reply to ${report.reporter_name.split(' ')[0]}…`}
            emptyText="No messages yet. Ask for details or tell the student what you're doing — they get an in-app, email and phone alert." />
        )}
      </div>
    </div>
  );
};

export default AdminReportChat;
