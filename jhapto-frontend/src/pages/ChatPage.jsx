import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';
import { getSocket } from '../utils/socket';

const ChatPage = () => {
  const { order_id } = useParams();
  const [messages, setMessages] = useState([]);
  const [orderStatus, setOrderStatus] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [blocked, setBlocked] = useState('');   // set when this chat isn't yours / doesn't exist
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const listRef = useRef(null);

  // Full history (also marks incoming messages as read on the server)
  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get(`/messages/${order_id}`);
      setMessages(res.data.messages || []);
      setOrderStatus(res.data.order_status);
      setError('');
    } catch (err) {
      const status = err.response?.status;
      if (status === 403 || status === 404) setBlocked(err.response.data?.message || 'This chat is not available.');
      else setError(err.response?.data?.message || 'Could not load messages.');
    }
  }, [order_id]);

  // Live updates over Socket.IO
  useEffect(() => {
    if (blocked) return undefined;
    fetchMessages();
    const socket = getSocket();

    const joinRoom = () => {
      socket.emit('chat:join', { order_id: Number(order_id) }, (ack) => {
        setLive(Boolean(ack && ack.ok));
        // catch up on anything sent while we were disconnected
        if (ack && ack.ok) fetchMessages();
      });
    };

    const onMessage = (msg) => {
      if (Number(msg.order_id) !== Number(order_id)) return;
      setMessages(prev => prev.some(m => m.message_id === msg.message_id) ? prev : [...prev, msg]);
      if (Number(msg.sender_id) !== Number(user.student_id)) {
        api.patch(`/messages/${order_id}/read`).catch(() => {});
      }
    };

    const onStatus = (payload) => {
      if (Number(payload.order_id) === Number(order_id)) setOrderStatus(payload.order_status);
    };

    const onDisconnect = () => setLive(false);

    socket.on('connect', joinRoom);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', onMessage);
    socket.on('order:status', onStatus);
    if (socket.connected) joinRoom();

    return () => {
      socket.emit('chat:leave', { order_id: Number(order_id) });
      socket.off('connect', joinRoom);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', onMessage);
      socket.off('order:status', onStatus);
    };
  }, [order_id, fetchMessages, user.student_id, blocked]);

  // Keep the newest message in view
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/messages/${order_id}`, { message_text: text });
      setNewMessage('');
      const msg = res.data.data;
      if (msg) setMessages(prev => prev.some(m => m.message_id === msg.message_id) ? prev : [...prev, msg]);
    } catch (err) {
      setError(err.response?.data?.message || 'Error sending message');
    } finally {
      setSending(false);
    }
  };

  if (blocked) {
    return (
      <>
        <Header user={user} onLogout={logout} onOrdersClick={() => navigate('/orders')} onSellerClick={() => navigate('/seller')} />
        <div style={{ padding: '2rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
          <h2 className="text-gradient" style={{ marginBottom: '1rem' }}>Chat - Order #{order_id}</h2>
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ marginBottom: '1rem' }}>{blocked}</p>
            <button className="auth-btn" style={{ marginTop: 0, padding: '0.6rem 1.5rem' }} onClick={() => navigate('/orders')}>Go to my orders</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header user={user} onLogout={logout} onOrdersClick={() => navigate('/orders')} onSellerClick={() => navigate('/seller')} />
      <div style={{ padding: '2rem 1rem', maxWidth: '800px', margin: '0 auto', height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem', gap: '1rem' }}>
          <h2 className="text-gradient">Chat - Order #{order_id}</h2>
          <span style={{ fontSize: '0.8rem', color: live ? '#2ecc71' : 'var(--text-secondary)' }} title={live ? 'New messages appear instantly' : 'Reconnecting…'}>
            {live ? '● Live' : '○ Connecting…'}
          </span>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div ref={listRef} className="glass-panel" aria-live="polite" style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
          {messages.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No messages yet. Say hi!</p>}
          {messages.map(msg => {
            const isMe = Number(msg.sender_id) === Number(user.student_id);
            return (
              <div key={msg.message_id} style={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                background: isMe ? 'linear-gradient(90deg, var(--primary-color), #00d2ff)' : 'rgba(255,255,255,0.1)',
                color: isMe ? '#000' : '#fff',
                padding: '0.8rem 1.2rem',
                borderRadius: '16px',
                borderBottomRightRadius: isMe ? '4px' : '16px',
                borderBottomLeftRadius: isMe ? '16px' : '4px',
                maxWidth: '70%',
                wordBreak: 'break-word',
              }}>
                {!isMe && <div style={{ fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '0.2rem', opacity: 0.7 }}>{msg.sender_name}</div>}
                <div>{msg.message_text}</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '0.25rem', textAlign: 'right' }}>
                  {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })}
        </div>

        {orderStatus === 'Placed' ? (
          <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
            This chat is locked. You can only chat after the seller confirms this order.
          </div>
        ) : ['Delivered', 'Cancelled'].includes(orderStatus) ? (
          <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
            This chat is closed because the order is {orderStatus.toLowerCase()}.
          </div>
        ) : (
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              value={newMessage}
              maxLength={1000}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              aria-label="Message"
              style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border-color)', outline: 'none' }}
            />
            <button type="submit" disabled={sending || !newMessage.trim()} className="auth-btn" style={{ marginTop: 0, padding: '0 2rem', opacity: sending ? 0.6 : 1 }}>Send</button>
          </form>
        )}
      </div>
    </>
  );
};

// Remount per order so state (messages, "not available", live status) never leaks between chats
const ChatRoute = () => {
  const { order_id } = useParams();
  return <ChatPage key={order_id} />;
};

export default ChatRoute;
