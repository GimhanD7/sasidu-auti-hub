import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { api } from '../../lib/api';
import './ServiceMessages.css';

const formatTime = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

function MessageBody({ body }) {
  const approvalPath = '/customer/repair-approvals';
  const parts = body.split(approvalPath);
  return <p className="service-message-body">{parts.map((part, index) => <span key={`${index}-${part}`}>{part}{index < parts.length - 1 && <Link to={approvalPath}>Open repair approval</Link>}</span>)}</p>;
}

export default function ServiceMessages() {
  const { user } = useAuth();
  const role = user?.role || 'Customer';
  const isCustomer = role === 'Customer';
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedJob = searchParams.get('job') || '';
  const [threads, setThreads] = useState(null);
  const [selectedId, setSelectedId] = useState(requestedJob);
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const selectedThread = threads?.find(thread => thread.jobId === selectedId);

  const loadThreads = useCallback(async signal => {
    try {
      const { data } = await api.get('/service-messages/threads', { signal });
      if (signal?.aborted) return;
      setThreads(data);
      setError('');
      const nextSelection = data.some(thread => thread.jobId === selectedId) ? selectedId
        : data.some(thread => thread.jobId === requestedJob) ? requestedJob
          : data.find(thread => thread.unreadCount)?.jobId || data[0]?.jobId || '';
      if (nextSelection !== selectedId) setSelectedId(nextSelection);
      if (nextSelection && nextSelection !== requestedJob) setSearchParams({ job: nextSelection }, { replace: true });
      if (!nextSelection && requestedJob) setSearchParams({}, { replace: true });
    } catch (err) {
      if (!signal?.aborted) setError(err.response?.data?.message || 'Unable to load your conversations.');
    }
  }, [requestedJob, selectedId, setSearchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => loadThreads(controller.signal), 0);
    const timer = window.setInterval(() => loadThreads(), 20000);
    return () => { controller.abort(); window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [loadThreads, retry]);

  const loadMessages = useCallback(async (jobId, signal) => {
    try {
      const { data } = await api.get(`/service-messages/${jobId}/messages`, { signal });
      if (signal?.aborted) return;
      setMessages(data);
      setError('');
      if (document.visibilityState === 'visible') {
        await api.patch(`/service-messages/${jobId}/read`, {}, { signal });
        setMessages(current => current?.map(message => ({ ...message, isRead: true })) || current);
        loadThreads();
      }
    } catch (err) {
      if (!signal?.aborted) setError(err.response?.data?.message || 'Unable to load this conversation.');
    }
  }, [loadThreads]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => loadMessages(selectedId, controller.signal), 0);
    const timer = window.setInterval(() => loadMessages(selectedId, controller.signal), 8000);
    return () => { controller.abort(); window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [selectedId, loadMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

  const selectThread = jobId => {
    setSelectedId(jobId);
    setSearchParams({ job: jobId });
  };

  const send = async event => {
    event.preventDefault();
    if (!selectedId || !draft.trim() || sending) return;
    setSending(true); setError('');
    try {
      const { data } = await api.post(`/service-messages/${selectedId}/messages`, { body: draft });
      setMessages(current => [...(current || []), data]);
      setDraft('');
      loadThreads();
    } catch (err) { setError(err.response?.data?.message || 'Unable to send your message. Please try again.'); }
    finally { setSending(false); }
  };

  return <main className="service-messages-page">
    <header className="messages-heading"><div><p className="messages-eyebrow">SERVICE WORKSHOP</p><h1>Messages</h1><p>{isCustomer ? 'Contact the workshop about a service job.' : 'Reply to customers about their service jobs.'}</p></div></header>
    {error && <div className="messages-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
    {threads?.length === 0 && <section className="messages-empty"><h2>No service jobs yet</h2><p>Conversations are available once a service job is created.</p>{isCustomer && <Link to="/customer/appointments">View appointments</Link>}</section>}
    {threads?.length > 0 && <div className="messages-layout">
      <aside className="message-thread-list" aria-label="Service conversations">
        {threads.map(thread => <button type="button" key={thread.jobId} className={`message-thread-button ${thread.jobId === selectedId ? 'selected' : ''}`} onClick={() => selectThread(thread.jobId)}>
          <span className="thread-title">{thread.customerName || thread.vehicle}</span><span className="thread-subtitle">{thread.serviceNumber} · {thread.jobStatus}</span><span className="thread-preview">{thread.latestMessage?.body || (isCustomer ? 'Start a conversation with the workshop' : 'No messages yet')}</span>{thread.unreadCount > 0 && <span className="thread-unread">{thread.unreadCount} unread</span>}
        </button>)}
      </aside>
      <section className="message-conversation" aria-label={`Conversation ${selectedThread?.serviceNumber || ''}`}>
        {selectedThread ? <>
          <header className="conversation-header"><div><h2>{selectedThread.vehicle}</h2><p>{selectedThread.serviceNumber} · {selectedThread.jobStatus}{selectedThread.customerName ? ` · ${selectedThread.customerName}` : ''}</p></div>{isCustomer && selectedThread.pendingApprovals > 0 && <Link to="/customer/repair-approvals">Open repair approval ({selectedThread.pendingApprovals})</Link>}</header>
          <div className="message-history" aria-live="polite">
            {messages === null && <p className="messages-placeholder">Loading conversation…</p>}
            {messages?.length === 0 && <p className="messages-placeholder">No messages yet. Send a message to start the conversation.</p>}
            {messages?.map(message => <article key={message.id} className={`service-message ${message.senderId === user?._id ? 'mine' : 'theirs'}`}>
              <div className="message-meta"><strong>{message.senderId === user?._id ? 'You' : message.senderName}</strong><time>{formatTime(message.createdAt)}</time></div>
              <MessageBody body={message.body} />
            </article>)}
            <div ref={bottomRef} />
          </div>
          <form className="message-composer" onSubmit={send}><label className="sr-only" htmlFor="message-draft">Message</label><textarea id="message-draft" value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={2} placeholder="Write a message…" /><div className="message-composer-footer"><span>{draft.length}/2000 · Updates automatically</span><button type="submit" disabled={sending || !draft.trim()}>{sending ? 'Sending…' : 'Send message'}</button></div></form>
        </> : <div className="messages-placeholder">Choose a service job to view its conversation.</div>}
      </section>
    </div>}
  </main>;
}
