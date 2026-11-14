import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../utils/api';
import CountBadge from './CountBadge';
import { getSocket, REALTIME_ENABLED } from '../utils/socket';

// With live updates this is just a safety net; without them it's how updates arrive
const POLL_MS = REALTIME_ENABLED ? 60000 : 15000;

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
  const [chats, setChats] = useState([]);   // [{ order_id, unread_count, from_name, item_name }]
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [n, m] = await Promise.all([api.get('/notifications'), api.get('/messages/unread')]);
      setNotifications(n.data.notifications);
      setUnread(n.data.unread_count);
      setUnreadChats(Number(m.data.unread_count) || 0);
      setChats(Array.isArray(m.data.chats) ? m.data.chats : []);
    } catch {
      // ignore polling errors (auth errors are handled by the api client)
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    const socket = getSocket();
    socket.on('notifications:changed', load);
    socket.on('connect', load);          // catch up after a reconnect
    return () => {
      clearInterval(interval);
      socket.off('notifications:changed', load);
      socket.off('connect', load);
    };
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
        <motion.span key={badge} style={{ display: 'flex' }} animate={badge > 0 ? { rotate: [0, -16, 12, -8, 0] } : {}} transition={{ duration: 0.6 }}>
          <Bell size={19} />
        </motion.span>
        <CountBadge count={badge} className="cart-badge danger" />
      </button>

      <AnimatePresence>
      {open && (
        <motion.div
          className="notif-panel"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
            <strong>Notifications</strong>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.8rem' }}>
                Mark all read
              </button>
            )}
          </div>

          {chats.map(c => (
            <button
              key={`chat-${c.order_id}`}
              onClick={() => { setOpen(false); navigate(`/chat/${c.order_id}`); }}
              className="notif-item unread chat"
            >
              <MessageCircle size={16} color="var(--primary-color)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', lineHeight: 1.35 }}>
                <strong>{c.unread_count} new message{c.unread_count > 1 ? 's' : ''}</strong> from {c.from_name}
                <span style={{ color: 'var(--text-secondary)' }}> · Order #{c.order_id} ({c.item_name})</span>
              </span>
            </button>
          ))}

          {notifications.length === 0 && unreadChats === 0 && (
            <p style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>You're all caught up.</p>
          )}

          {notifications.map(n => (
            <button
              key={n.notification_id}
              onClick={() => openNotification(n)}
              className={`notif-item ${n.is_read ? '' : 'unread'}`}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: n.is_read ? 400 : 600, lineHeight: 1.35 }}>{n.message}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{timeAgo(n.created_at)}</div>
            </button>
          ))}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
