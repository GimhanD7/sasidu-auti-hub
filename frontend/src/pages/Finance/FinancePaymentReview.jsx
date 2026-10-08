import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import './FinancePaymentReview.css';

const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'LKR', maximumFractionDigits: 2 }).format(Number(value) || 0);
const dateTime = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date); };

export default function FinancePaymentReview() {
  const [payments, setPayments] = useState(null);
  const [reasons, setReasons] = useState({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/finance/payments', { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) { setPayments(data); setError(''); } })
      .catch(err => { if (!controller.signal.aborted) setError(err.response?.data?.message || 'Unable to load payment records.'); });
    return () => controller.abort();
  }, [retry]);

  const review = async (payment, decision) => {
    setBusyId(payment.id); setError(''); setNotice('');
    try {
      const { data } = await api.patch(`/finance/payments/${payment.id}/review`, { decision, failureReason: reasons[payment.id] || '' });
      setPayments(current => current?.map(item => item.id === payment.id ? { ...item, status: data.status, failureReason: decision === 'Failed' ? reasons[payment.id] || 'Payment could not be verified.' : '' } : item));
      setNotice(`${payment.receiptNumber} marked ${decision.toLowerCase()}.`);
    } catch (err) { setError(err.response?.data?.message || 'Unable to review this payment.'); }
    finally { setBusyId(''); }
  };
  const pendingCount = payments?.filter(payment => payment.status === 'Pending Verification').length || 0;

  return <main className="finance-payment-review">
    <header className="finance-payment-heading"><div><p>FINANCE</p><h1>Payment Review</h1><span>Verify submitted bank transfers and pay-at-workshop records.</span></div><strong>{pendingCount} pending</strong></header>
    {error && <div className="finance-payment-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    {notice && <div className="finance-payment-success" role="status">{notice}</div>}
    {payments === null && !error && <p className="finance-payment-loading" role="status">Loading payment records…</p>}
    {payments?.length === 0 && <section className="finance-payment-empty">No payment submissions have been recorded.</section>}
    <div className="finance-payment-list">{payments?.map(payment => <article className="finance-payment-card" key={payment.id}>
      <header><div><h2>{payment.receiptNumber}</h2><p>{payment.invoice?.invoiceNumber || 'Invoice unavailable'} · {payment.invoice?.paymentStatus || ''}</p></div><span className={`finance-payment-status ${payment.status.toLowerCase().replaceAll(' ', '-')}`}>{payment.status}</span></header>
      <dl><div><dt>Customer</dt><dd>{payment.customer?.name || 'Unknown'}{payment.customer?.email ? ` · ${payment.customer.email}` : ''}</dd></div><div><dt>Amount</dt><dd>{money(payment.amount)}</dd></div><div><dt>Method</dt><dd>{payment.method}</dd></div><div><dt>Transaction reference</dt><dd>{payment.transactionReference}</dd></div><div><dt>Submitted</dt><dd>{dateTime(payment.createdAt)}</dd></div></dl>
      {payment.status === 'Pending Verification' && <div className="finance-payment-actions"><label>Reason if not verified<textarea value={reasons[payment.id] || ''} onChange={event => setReasons(current => ({ ...current, [payment.id]: event.target.value }))} maxLength={500} rows={2} /></label><div><button type="button" disabled={busyId === payment.id} className="finance-payment-fail" onClick={() => review(payment, 'Failed')}>{busyId === payment.id ? 'Saving…' : 'Reject'}</button><button type="button" disabled={busyId === payment.id} className="finance-payment-complete" onClick={() => review(payment, 'Completed')}>{busyId === payment.id ? 'Saving…' : 'Confirm payment'}</button></div></div>}
      {payment.failureReason && <p className="finance-payment-reason">Review note: {payment.failureReason}</p>}
    </article>)}</div>
  </main>;
}
