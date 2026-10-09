import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import FinancePaymentHistory from './FinancePaymentHistory';

const money = (value) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const dateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export default function FinancePaymentReview() {
  const [mode, setMode] = useState('verify');
  const [payments, setPayments] = useState(null);
  const [reasons, setReasons] = useState({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const [previewSlip, setPreviewSlip] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/admin/payments', { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setPayments(data);
          setError('');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.response?.data?.message || 'Unable to load payment records.');
      });
    return () => controller.abort();
  }, [retry]);

  const review = async (payment, decision) => {
    setBusyId(payment.id);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch(`/admin/payments/${payment.id}/review`, {
        decision,
        failureReason: reasons[payment.id] || '',
      });
      setPayments((current) =>
        current?.map((item) =>
          item.id === payment.id
            ? {
                ...item,
                status: data.status,
                failureReason:
                  decision === 'Failed'
                    ? reasons[payment.id] || 'Payment could not be verified.'
                    : '',
              }
            : item,
        ),
      );
      setNotice(`${payment.receiptNumber || 'Payment'} marked as ${decision.toLowerCase()}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to review this payment.');
    } finally {
      setBusyId('');
    }
  };

  const pendingPayments = payments?.filter((p) => p.status === 'Pending Verification') || [];
  const reviewedPayments = payments?.filter((p) => p.status !== 'Pending Verification') || [];

  if (mode !== 'verify') {
    return (
      <div className="finance-payment-review">
        <nav className="finance-payment-tabs" aria-label="Payment pages">
          <button type="button" onClick={() => setMode('verify')}>
            Verify payments ({pendingPayments.length})
          </button>
          <button
            type="button"
            className="active"
            aria-current="page"
            onClick={() => setMode('history')}
          >
            Payment history
          </button>
        </nav>
        <FinancePaymentHistory />
      </div>
    );
  }

  return (
    <main className="finance-payment-review">
      <header className="finance-payment-heading">
        <div>
          <p>ADMIN · BILLING</p>
          <h1>Payment Verification</h1>
          <span>Review and verify customer payment submissions.</span>
        </div>
        <strong>{pendingPayments.length} pending verification</strong>
      </header>

      <nav className="finance-payment-tabs" aria-label="Payment pages">
        <button type="button" className="active" aria-current="page">
          Verify payments ({pendingPayments.length})
        </button>
        <button type="button" onClick={() => setMode('history')}>
          Payment history
        </button>
      </nav>

      {error && (
        <div className="finance-payment-error" role="alert" style={{ margin: '1rem 0' }}>
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            Try again
          </button>
        </div>
      )}

      {notice && (
        <div className="finance-payment-success" role="status" style={{ margin: '1rem 0' }}>
          {notice}
        </div>
      )}

      {payments === null && !error && (
        <p className="finance-payment-loading" role="status">
          Loading payment records…
        </p>
      )}

      {payments !== null && pendingPayments.length === 0 && (
        <section className="section-card" style={{ textAlign: 'center', padding: '3rem 1rem', margin: '1rem 0' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>No pending payments to verify</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.88rem' }}>
            Customer bank transfers and payment submissions will appear in this table when submitted.
          </p>
        </section>
      )}

      {pendingPayments.length > 0 && (
        <div className="section-card" style={{ padding: '0.75rem', overflowX: 'auto', margin: '1rem 0' }}>
          <table className="finance-payment-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left' }}>Receipt / Ref</th>
                <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left' }}>Customer</th>
                <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left' }}>Invoice</th>
                <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left' }}>Amount & Method</th>
                <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left' }}>Submitted</th>
                <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left' }}>Payment Slip</th>
                <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left' }}>Rejection Reason (if rejecting)</th>
                <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingPayments.map((payment) => (
                <tr key={payment.id} style={{ borderBottom: '1px solid var(--border-color)', verticalAlign: 'middle' }}>
                  <td style={{ padding: '0.75rem 0.6rem' }}>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{payment.receiptNumber || 'Pending'}</strong>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>{payment.transactionReference || 'No Ref'}</small>
                  </td>
                  <td style={{ padding: '0.75rem 0.6rem' }}>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{payment.customer?.name || 'Unknown'}</strong>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>{payment.customer?.email || ''}</small>
                  </td>
                  <td style={{ padding: '0.75rem 0.6rem' }}>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{payment.invoice?.invoiceNumber || '—'}</strong>
                    <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: '#3f3f46', color: '#e4e4e7' }}>
                      {payment.invoice?.paymentStatus || 'Issued'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.6rem' }}>
                    <strong style={{ display: 'block', color: '#22c55e' }}>{money(payment.amount)}</strong>
                    <small style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>{payment.method}</small>
                  </td>
                  <td style={{ padding: '0.75rem 0.6rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    {dateTime(payment.createdAt)}
                  </td>
                  <td style={{ padding: '0.75rem 0.6rem' }}>
                    {payment.paymentSlip?.data ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {payment.paymentSlip.contentType?.startsWith('image/') ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewSlip({
                                url: `data:${payment.paymentSlip.contentType};base64,${payment.paymentSlip.data}`,
                                fileName: payment.paymentSlip.fileName || 'Payment Slip',
                              })
                            }
                            style={{
                              background: '#27272a',
                              border: '1px solid #52525b',
                              color: '#60a5fa',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            👁 View Slip
                          </button>
                        ) : null}
                        <a
                          href={`data:${payment.paymentSlip.contentType};base64,${payment.paymentSlip.data}`}
                          download={payment.paymentSlip.fileName || 'payment-slip'}
                          style={{ color: '#a1a1aa', fontSize: '0.72rem', textDecoration: 'underline' }}
                        >
                          ⬇ Download ({payment.paymentSlip.fileSize ? `${(payment.paymentSlip.fileSize / 1024).toFixed(0)} KB` : 'file'})
                        </a>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No slip</span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem 0.6rem', minWidth: '180px' }}>
                    <input
                      type="text"
                      value={reasons[payment.id] || ''}
                      onChange={(e) => setReasons((curr) => ({ ...curr, [payment.id]: e.target.value }))}
                      placeholder="Reason if rejecting..."
                      maxLength={300}
                      style={{
                        width: '100%',
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.78rem',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </td>
                  <td style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        disabled={busyId === payment.id}
                        onClick={() => review(payment, 'Failed')}
                        style={{
                          background: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '5px',
                          fontWeight: '600',
                          fontSize: '0.78rem',
                          cursor: busyId === payment.id ? 'not-allowed' : 'pointer',
                          opacity: busyId === payment.id ? 0.6 : 1,
                        }}
                      >
                        {busyId === payment.id ? 'Saving…' : 'Reject'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === payment.id}
                        onClick={() => review(payment, 'Completed')}
                        style={{
                          background: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '5px',
                          fontWeight: '700',
                          fontSize: '0.78rem',
                          cursor: busyId === payment.id ? 'not-allowed' : 'pointer',
                          opacity: busyId === payment.id ? 0.6 : 1,
                        }}
                      >
                        {busyId === payment.id ? 'Saving…' : 'Confirm'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewedPayments.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h3 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Recently Processed in this Session ({reviewedPayments.length})
          </h3>
          <div className="section-card" style={{ padding: '0.75rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Receipt</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Customer</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Invoice</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Amount</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {reviewedPayments.map((payment) => (
                  <tr key={payment.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: 0.8 }}>
                    <td style={{ padding: '0.55rem' }}>{payment.receiptNumber || '—'}</td>
                    <td style={{ padding: '0.55rem' }}>{payment.customer?.name || '—'}</td>
                    <td style={{ padding: '0.55rem' }}>{payment.invoice?.invoiceNumber || '—'}</td>
                    <td style={{ padding: '0.55rem', fontWeight: '600' }}>{money(payment.amount)}</td>
                    <td style={{ padding: '0.55rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          background: payment.status === 'Completed' ? '#14532d' : '#7f1d1d',
                          color: payment.status === 'Completed' ? '#86efac' : '#fca5a5',
                        }}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.55rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {payment.failureReason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Payment Slip Modal */}
      {previewSlip && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setPreviewSlip(null)}
        >
          <div
            style={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '10px',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid #3f3f46',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#f4f4f5' }}>
                📷 {previewSlip.fileName}
              </span>
              <button
                type="button"
                onClick={() => setPreviewSlip(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a1a1aa',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  padding: '0.2rem 0.5rem',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '1rem', overflowY: 'auto', textAlign: 'center', backgroundColor: '#09090b' }}>
              <img
                src={previewSlip.url}
                alt={previewSlip.fileName}
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '6px' }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
