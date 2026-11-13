import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import './Chat.css';

const when = (d) => new Date(d).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Conversation about a report. `me` is 'student' or 'admin' (whose bubbles go on the right).
const ReportThread = ({ messages, me, onSend, placeholder = 'Write a message…', emptyText }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError('');
    try {
      await onSend(text.trim());
      setText('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="report-thread">
      <div ref={listRef} className="chat-messages report-thread-messages" aria-live="polite">
        {messages.length === 0 && <p className="chat-empty">{emptyText}</p>}
        {messages.map((m) => (
          <div key={m.report_message_id} className={`bubble ${m.sender_role === me ? 'mine' : 'theirs'}`}>
            {m.sender_role !== me && <div className="bubble-sender">{m.sender_name}</div>}
            <div>{m.message_text}</div>
            <div className="bubble-time">{when(m.created_at)}</div>
          </div>
        ))}
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <form onSubmit={submit} className="chat-composer">
        <input className="input" type="text" value={text} maxLength={1000} placeholder={placeholder}
          aria-label="Message" autoComplete="off" onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()} aria-label="Send message">
          <Send size={17} />
        </button>
      </form>
    </div>
  );
};

export default ReportThread;
