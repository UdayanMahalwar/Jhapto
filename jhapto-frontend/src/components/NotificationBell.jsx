import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircle } from 'lucide-react';
import api from '../utils/api';

const POLL_MS = 15000;

const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
};

// Bell with a dropdown of order/review notifications plus unread chat count
const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [n, m] = await Promise.all([api.get('/notifications'), api.get('/messages/unread')]);
      setNotifications(n.data.notifications);
      setUnread(n.data.unread_count);
      setUnreadChats(Number(m.data.unread_count) || 0);
    } catch {
      // ignore polling errors (auth errors are handled by the api client)
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openNotification = async (n) => {
    setOpen(false);
    if (!n.is_read) {
      setNotifications(prev => prev.map(x => x.notification_id === n.notification_id ? { ...x, is_read: 1 } : x));
      setUnread(u => Math.max(0, u - 1));
      api.patch(`/notifications/${n.notification_id}/read`).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(x => ({ ...x, is_read: 1 })));
    setUnread(0);
    api.patch('/notifications/read-all').catch(() => {});
  };

  const badge = unread + unreadChats;

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        aria-label={`Notifications${badge ? ` (${badge} unread)` : ''}`}
        aria-expanded={open}
        style={{ position: 'relative' }}
      >
        <Bell size={20} />
        {badge > 0 && <span className="cart-badge" style={{ background: 'var(--secondary-color)' }}>{badge > 99 ? '99+' : badge}</span>}
      </button>

      {open && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 'min(340px, calc(100vw - 32px))',
            maxHeight: '420px', overflowY: 'auto', zIndex: 1100, padding: '0.5rem',
            background: 'var(--surface-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
            <strong>Notifications</strong>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.8rem' }}>
                Mark all read
              </button>
            )}
          </div>

          {unreadChats > 0 && (
            <button
              onClick={() => { setOpen(false); navigate('/orders'); }}
              style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', width: '100%', textAlign: 'left', padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(69, 243, 255, 0.08)', color: 'white', marginBottom: '0.25rem' }}
            >
              <MessageCircle size={16} color="var(--primary-color)" />
              <span style={{ fontSize: '0.85rem' }}>{unreadChats} unread chat message{unreadChats > 1 ? 's' : ''}</span>
            </button>
          )}

          {notifications.length === 0 && unreadChats === 0 && (
            <p style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>You're all caught up.</p>
          )}

          {notifications.map(n => (
            <button
              key={n.notification_id}
              onClick={() => openNotification(n)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: n.is_read ? 'transparent' : 'rgba(247, 37, 133, 0.08)', color: 'white', marginBottom: '0.25rem',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: n.is_read ? 400 : 600, lineHeight: 1.35 }}>{n.message}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{timeAgo(n.created_at)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
