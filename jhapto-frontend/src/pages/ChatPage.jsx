import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Lock } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import '../components/Chat.css';
import Header from '../components/Header';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';
import { getSocket, REALTIME_ENABLED } from '../utils/socket';

const ChatPage = () => {
  const { order_id } = useParams();
  const [messages, setMessages] = useState([]);
  const [orderStatus, setOrderStatus] = useState('');
  const [orderInfo, setOrderInfo] = useState(null);   // { item_name, quantity, role, other_name }
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
      if (res.data.order) setOrderInfo(res.data.order);
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

  // Without live updates (serverless hosting), check for new messages every few seconds
  useEffect(() => {
    if (REALTIME_ENABLED || blocked) return undefined;
    const t = setInterval(() => { if (!document.hidden) fetchMessages(); }, 3000);
    return () => clearInterval(t);
  }, [fetchMessages, blocked]);

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
        <main className="page page-narrow">
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true"><Lock size={22} /></div>
            <h3>Chat not available</h3>
            <p>{blocked}</p>
            <button className="btn btn-primary" onClick={() => navigate('/orders')}>Go to my orders</button>
          </div>
        </main>
      </>
    );
  }

  const backTo = orderInfo?.role === 'seller' ? '/seller' : '/orders';
  const timeOf = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <Header user={user} onLogout={logout} onOrdersClick={() => navigate('/orders')} onSellerClick={() => navigate('/seller')} />
      <main className="chat-page">
        <div className="card chat-header">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(backTo)} aria-label="Back to orders">
            <ArrowLeft size={16} />
          </button>
          <div className="chat-header-text">
            <div className="chat-header-title">{orderInfo ? orderInfo.other_name : `Order #${order_id}`}</div>
            <div className="muted small chat-header-sub">
              {orderInfo ? `${orderInfo.role === 'buyer' ? 'Seller' : 'Buyer'} · ${orderInfo.item_name} × ${orderInfo.quantity} · Order #${order_id}` : 'Loading…'}
            </div>
          </div>
          <div className="chat-header-side">
            {orderStatus && <StatusBadge status={orderStatus} />}
            {REALTIME_ENABLED ? (
              <span className={`chat-live ${live ? 'on' : ''}`} title={live ? 'New messages appear instantly' : 'Reconnecting…'}>
                {live ? 'Live' : 'Connecting…'}
              </span>
            ) : (
              <span className="chat-live on" title="New messages are checked every few seconds">Auto-refresh</span>
            )}
          </div>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <div ref={listRef} className="card chat-messages" aria-live="polite">
          {messages.length === 0 && (
            <p className="chat-empty">No messages yet.{orderStatus === 'Confirmed' ? ' Say hi and agree where to meet!' : ''}</p>
          )}
          {messages.map((msg, i) => {
            const isMe = Number(msg.sender_id) === Number(user.student_id);
            const prev = messages[i - 1];
            const grouped = prev && prev.sender_id === msg.sender_id;
            return (
              <div key={msg.message_id} className={`bubble ${isMe ? 'mine' : 'theirs'} ${grouped ? 'grouped' : ''}`}>
                <div>{msg.message_text}</div>
                <div className="bubble-time">{timeOf(msg.sent_at)}</div>
              </div>
            );
          })}
        </div>

        {orderStatus === 'Placed' ? (
          <div className="chat-notice"><Lock size={15} /> Chat opens once the seller confirms this order.</div>
        ) : ['Delivered', 'Cancelled'].includes(orderStatus) ? (
          <div className="chat-notice"><Lock size={15} /> This chat is closed because the order was {orderStatus.toLowerCase()}.</div>
        ) : orderStatus ? (
          <form onSubmit={handleSend} className="chat-composer">
            <input
              className="input"
              type="text"
              value={newMessage}
              maxLength={1000}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={orderInfo ? `Message ${orderInfo.other_name.split(' ')[0]}…` : 'Type a message…'}
              aria-label="Message"
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary" disabled={sending || !newMessage.trim()} aria-label="Send message">
              <Send size={17} />
            </button>
          </form>
        ) : null}
      </main>
    </>
  );
};

// Remount per order so state (messages, "not available", live status) never leaks between chats
const ChatRoute = () => {
  const { order_id } = useParams();
  return <ChatPage key={order_id} />;
};

export default ChatRoute;
