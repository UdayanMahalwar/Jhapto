import React, { useState } from 'react';
import api from '../utils/api';
import { uploadImage } from '../utils/upload';
import { useToast } from '../contexts/ToastContext';
import FilePicker from './FilePicker';

// Report the other person on an order (buyer reports seller, or seller reports buyer)
const ReportDialog = ({ order, reportedUserId, reportedName, roleLabel, onClose }) => {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [proof, setProof] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const pickProof = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      setProof(await uploadImage(file));
    } catch (err) {
      e.target.value = '';
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return setError('Tell us what happened.');
    setSending(true);
    setError('');
    try {
      await api.post('/reports', { order_id: order.order_id, reported_user_id: reportedUserId, reason, proof_url: proof });
      toast('Report submitted. Admins will review it.');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting report');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <form className="modal stack" onSubmit={submit}>
        <div>
          <h3 id="report-title" className="modal-title">Report {roleLabel.toLowerCase()}</h3>
          <p className="muted small">{reportedName} · Order #{order.order_id} ({order.item_name})</p>
        </div>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <label className="field">
          <span>What happened?</span>
          <textarea className="input" maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the problem so an admin can look into it." autoFocus />
        </label>
        <div className="field">
          <span>Proof (optional)</span>
          <FilePicker value={proof} uploading={uploading} onChange={pickProof} onRemove={() => setProof('')} label="Attach a screenshot or photo" />
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-danger" disabled={uploading || sending}>{sending ? 'Sending…' : 'Submit report'}</button>
        </div>
      </form>
    </div>
  );
};

export default ReportDialog;
