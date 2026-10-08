import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import './CustomerNotifications.css';

const formatTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
const safeInternalLink = (value) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '';

export default function CustomerNotifications() {
  const [notifications, setNotifications] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('All');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/customer-notifications', { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
          setError('');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.response?.data?.message || 'Unable to load your notifications.');
      });
    return () => controller.abort();
  }, [retry]);

  const visible = useMemo(
    () => (notifications || []).filter((item) => filter === 'All' || !item.isRead),
    [notifications, filter],
  );
  const markRead = async (id) => {
    const notification = notifications?.find((item) => item.id === id);
    if (!notification || notification.isRead) return;
    try {
      await api.patch(`/customer-notifications/${id}/read`);
      setNotifications(
        (current) =>
          current?.map((item) => (item.id === id ? { ...item, isRead: true } : item)) || [],
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to mark this notification as read.');
    }
  };
  const markAllRead = async () => {
    if (!unreadCount || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.patch('/customer-notifications/read-all');
      setNotifications((current) => current?.map((item) => ({ ...item, isRead: true })) || []);
      setUnreadCount(0);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to mark notifications as read.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="customer-notifications-page">
      <header className="notifications-heading">
        <div>
          <p className="notifications-eyebrow">YOUR ACCOUNT</p>
          <h1>Notifications</h1>
          <p>Service and account updates from your workshop.</p>
        </div>
        <button type="button" onClick={markAllRead} disabled={!unreadCount || busy}>
          {busy ? 'Updating…' : 'Mark all as read'}
        </button>
      </header>
      <div className="notification-controls">
        <div className="notification-filters" role="group" aria-label="Filter notifications">
          <button
            type="button"
            className={filter === 'All' ? 'active' : ''}
            onClick={() => setFilter('All')}
          >
            All
          </button>
          <button
            type="button"
            className={filter === 'Unread' ? 'active' : ''}
            onClick={() => setFilter('Unread')}
          >
            Unread <span>{unreadCount}</span>
          </button>
        </div>
        <span className="notifications-count">{notifications?.length ?? '…'} recent</span>
      </div>
      {error && (
        <div className="notifications-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {notifications === null && !error && (
        <div className="notifications-loading" role="status">
          Loading notifications…
        </div>
      )}
      {notifications?.length === 0 && (
        <section className="notifications-empty">
          <span aria-hidden="true">✓</span>
          <h2>You’re all caught up</h2>
          <p>New appointment, repair and invoice updates will appear here.</p>
        </section>
      )}
      {notifications?.length > 0 && visible.length === 0 && (
        <section className="notifications-empty">
          <h2>No unread notifications</h2>
          <p>You’ve read all recent updates.</p>
        </section>
      )}
      <div className="notification-feed">
        {visible.map((item) => {
          const to = safeInternalLink(item.link);
          return (
            <article
              key={item.id}
              className={`customer-notification ${item.isRead ? 'read' : 'unread'}`}
            >
              <span className="notification-indicator" aria-hidden="true" />
              <div className="notification-copy">
                <div className="notification-title-row">
                  <h2>{item.title}</h2>
                  <time>{formatTime(item.createdAt)}</time>
                </div>
                <p>{item.message}</p>
                {to && (
                  <Link to={to} onClick={() => markRead(item.id)}>
                    {item.type === 'ApprovalRequest'
                      ? 'Review approval'
                      : item.type.startsWith('Invoice') || item.type === 'PaymentConfirmation'
                        ? 'View invoices'
                        : item.type === 'NewServiceMessage'
                          ? 'Open conversation'
                          : 'View details'}{' '}
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
              {!item.isRead && (
                <button
                  className="mark-notification-read"
                  type="button"
                  onClick={() => markRead(item.id)}
                >
                  Mark read
                </button>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
