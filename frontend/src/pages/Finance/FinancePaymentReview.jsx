import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import FinancePaymentHistory from './FinancePaymentHistory';
import FinanceOutstandingPayments from './FinanceOutstandingPayments';
import './FinancePaymentReview.css';

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
  const [mode, setMode] = useState('process');
  const [payments, setPayments] = useState(null);
  const [payableInvoices, setPayableInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [transactionReference, setTransactionReference] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [recording, setRecording] = useState(false);
  const [reasons, setReasons] = useState({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.get('/finance/payments', { signal: controller.signal }),
      api.get('/finance/payments/payable-invoices', { signal: controller.signal }),
    ])
      .then(([{ data: paymentData }, { data: invoiceData }]) => {
        if (!controller.signal.aborted) {
          setPayments(paymentData);
          setPayableInvoices(invoiceData.invoices || []);
          setSelectedInvoiceId((current) => current || invoiceData.invoices?.[0]?.id || '');
          setAmount((current) => current || String(invoiceData.invoices?.[0]?.amountDue || ''));
          setError('');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.response?.data?.message || 'Unable to load payment records.');
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const afterPrint = () => setPrintingReceipt(false);
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, []);

  const review = async (payment, decision) => {
    setBusyId(payment.id);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch(`/finance/payments/${payment.id}/review`, {
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
      setNotice(`${payment.receiptNumber} marked ${decision.toLowerCase()}.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to review this payment.');
    } finally {
      setBusyId('');
    }
  };
  const pendingCount =
    payments?.filter((payment) => payment.status === 'Pending Verification').length || 0;
  const selectedInvoice = payableInvoices.find((invoice) => invoice.id === selectedInvoiceId);
  const recordPayment = async (event) => {
    event.preventDefault();
    setRecording(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post('/finance/payments/record', {
        invoiceId: selectedInvoiceId,
        amount: Number(amount),
        method,
        transactionReference,
      });
      const payment = {
        ...data.payment,
        invoice: {
          id: data.payment.invoiceId,
          invoiceNumber: data.payment.invoiceNumber,
          paymentStatus: data.invoice.paymentStatus,
        },
        customer: selectedInvoice?.customer || null,
        failureReason: '',
      };
      setPayments((current) => [payment, ...(current || [])]);
      setReceipt({
        ...data.payment,
        customer: selectedInvoice?.customer?.name || 'Customer',
        emailSent: data.receiptEmailSent,
      });
      setNotice(
        `${data.message}${data.receiptEmailSent ? ' Receipt emailed to the customer.' : ' A printable receipt is ready below.'}`,
      );
      if (data.invoice.amountDue <= 0) {
        const nextInvoice = payableInvoices.find((item) => item.id !== selectedInvoiceId);
        setPayableInvoices((current) => current.filter((item) => item.id !== selectedInvoiceId));
        setSelectedInvoiceId(nextInvoice?.id || '');
        setAmount(nextInvoice ? String(nextInvoice.amountDue) : '');
      } else {
        setPayableInvoices((current) =>
          current.map((item) =>
            item.id === selectedInvoiceId
              ? {
                  ...item,
                  amountPaid: data.invoice.amountPaid,
                  amountDue: data.invoice.amountDue,
                  paymentStatus: data.invoice.paymentStatus,
                }
              : item,
          ),
        );
        setAmount(String(data.invoice.amountDue));
      }
      setTransactionReference('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to record this payment.');
    } finally {
      setRecording(false);
    }
  };

  if (mode !== 'process')
    return (
      <div className="finance-payment-review">
        <nav className="finance-payment-tabs" aria-label="Payment pages">
          <button type="button" onClick={() => setMode('process')}>
            Process payments
          </button>
          <button
            type="button"
            className={mode === 'history' ? 'active' : ''}
            aria-current={mode === 'history' ? 'page' : undefined}
            onClick={() => setMode('history')}
          >
            Payment history
          </button>
          <button
            type="button"
            className={mode === 'outstanding' ? 'active' : ''}
            aria-current={mode === 'outstanding' ? 'page' : undefined}
            onClick={() => setMode('outstanding')}
          >
            Outstanding payments
          </button>
        </nav>
        {mode === 'history' ? <FinancePaymentHistory /> : <FinanceOutstandingPayments />}
      </div>
    );
  return (
    <main className={`finance-payment-review ${printingReceipt ? 'printing-receipt' : ''}`}>
      <header className="finance-payment-heading">
        <div>
          <p>FINANCE</p>
          <h1>Payment Review</h1>
          <span>Verify submitted bank transfers and pay-at-workshop records.</span>
        </div>
        <strong>{pendingCount} pending</strong>
      </header>
      <nav className="finance-payment-tabs" aria-label="Payment pages">
        <button type="button" className="active" aria-current="page">
          Process payments
        </button>
        <button type="button" onClick={() => setMode('history')}>
          Payment history
        </button>
        <button type="button" onClick={() => setMode('outstanding')}>
          Outstanding payments
        </button>
      </nav>
      {error && (
        <div className="finance-payment-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {notice && (
        <div className="finance-payment-success" role="status">
          {notice}
        </div>
      )}
      <section className="finance-record-payment">
        <div>
          <h2>Record payment</h2>
          <p>Select an issued invoice and enter the payment details.</p>
        </div>
        {payableInvoices.length ? (
          <form onSubmit={recordPayment}>
            <label>
              Invoice
              <select
                required
                value={selectedInvoiceId}
                onChange={(event) => {
                  const next = payableInvoices.find((item) => item.id === event.target.value);
                  setSelectedInvoiceId(event.target.value);
                  setAmount(next ? String(next.amountDue) : '');
                  setReceipt(null);
                }}
              >
                <option value="">Select an invoice</option>
                {payableInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoiceNumber} · {invoice.customer?.name || 'Customer'} · Due{' '}
                    {money(invoice.amountDue)}
                  </option>
                ))}
              </select>
            </label>
            {selectedInvoice && (
              <div className="finance-record-balance">
                <span>Outstanding balance</span>
                <strong>{money(selectedInvoice.amountDue)}</strong>
                <small>
                  {selectedInvoice.serviceNumber}
                  {selectedInvoice.vehicle ? ` · ${selectedInvoice.vehicle}` : ''}
                </small>
              </div>
            )}
            <label>
              Amount received
              <input
                type="number"
                min="0.01"
                max={selectedInvoice?.amountDue}
                step="0.01"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label>
              Payment method
              <select value={method} onChange={(event) => setMethod(event.target.value)}>
                <option>Cash</option>
                <option>Card</option>
                <option>Online</option>
                <option>Bank Transfer</option>
                <option>Pay at Workshop</option>
              </select>
            </label>
            <label>
              Transaction reference
              {['Card', 'Online', 'Bank Transfer'].includes(method) ? ' (required)' : ' (optional)'}
              <input
                value={transactionReference}
                onChange={(event) => setTransactionReference(event.target.value)}
                maxLength={100}
                minLength={['Card', 'Online', 'Bank Transfer'].includes(method) ? 3 : undefined}
                required={['Card', 'Online', 'Bank Transfer'].includes(method)}
                placeholder={
                  method === 'Cash' || method === 'Pay at Workshop'
                    ? 'Generated automatically if left blank'
                    : 'Enter receipt, transfer or transaction ID'
                }
              />
            </label>
            <button type="submit" disabled={recording || !selectedInvoice}>
              {recording ? 'Recording…' : 'Process payment'}
            </button>
          </form>
        ) : (
          <p className="finance-record-empty">No issued invoices have a balance due.</p>
        )}
      </section>
      {receipt && (
        <section className="finance-payment-receipt" role="status">
          <div>
            <span>PAYMENT RECEIPT</span>
            <h2>{receipt.receiptNumber}</h2>
            <p>
              {receipt.invoiceNumber} · {receipt.customer}
            </p>
            <strong>
              {money(receipt.amount)} · {receipt.method}
            </strong>
            <small>
              Reference {receipt.transactionReference} · {dateTime(receipt.reviewedAt)} · Completed
            </small>
          </div>
          <button
            type="button"
            onClick={() => {
              setPrintingReceipt(true);
              window.setTimeout(() => window.print(), 120);
            }}
          >
            Print / Download PDF
          </button>
          <article className="finance-payment-print-receipt">
            <p>AUTOSERV PRO · PAYMENT RECEIPT</p>
            <h1>{receipt.receiptNumber}</h1>
            <p>Customer: {receipt.customer}</p>
            <p>Invoice: {receipt.invoiceNumber}</p>
            <p>Amount received: {money(receipt.amount)}</p>
            <p>Method: {receipt.method}</p>
            <p>Transaction reference: {receipt.transactionReference}</p>
            <p>Status: Completed</p>
            <p>Payment date: {dateTime(receipt.reviewedAt)}</p>
          </article>
        </section>
      )}
      {payments === null && !error && (
        <p className="finance-payment-loading" role="status">
          Loading payment records…
        </p>
      )}
      {payments?.length === 0 && (
        <section className="finance-payment-empty">
          No payment submissions have been recorded.
        </section>
      )}
      <div className="finance-payment-list">
        {payments?.map((payment) => (
          <article className="finance-payment-card" key={payment.id}>
            <header>
              <div>
                <h2>{payment.receiptNumber}</h2>
                <p>
                  {payment.invoice?.invoiceNumber || 'Invoice unavailable'} ·{' '}
                  {payment.invoice?.paymentStatus || ''}
                </p>
              </div>
              <span
                className={`finance-payment-status ${payment.status.toLowerCase().replaceAll(' ', '-')}`}
              >
                {payment.status}
              </span>
            </header>
            <dl>
              <div>
                <dt>Customer</dt>
                <dd>
                  {payment.customer?.name || 'Unknown'}
                  {payment.customer?.email ? ` · ${payment.customer.email}` : ''}
                </dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{money(payment.amount)}</dd>
              </div>
              <div>
                <dt>Method</dt>
                <dd>{payment.method}</dd>
              </div>
              <div>
                <dt>Transaction reference</dt>
                <dd>{payment.transactionReference}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{dateTime(payment.createdAt)}</dd>
              </div>
            </dl>
            {payment.status === 'Pending Verification' && (
              <div className="finance-payment-actions">
                <label>
                  Reason if not verified
                  <textarea
                    value={reasons[payment.id] || ''}
                    onChange={(event) =>
                      setReasons((current) => ({ ...current, [payment.id]: event.target.value }))
                    }
                    maxLength={500}
                    rows={2}
                  />
                </label>
                <div>
                  <button
                    type="button"
                    disabled={busyId === payment.id}
                    className="finance-payment-fail"
                    onClick={() => review(payment, 'Failed')}
                  >
                    {busyId === payment.id ? 'Saving…' : 'Reject'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === payment.id}
                    className="finance-payment-complete"
                    onClick={() => review(payment, 'Completed')}
                  >
                    {busyId === payment.id ? 'Saving…' : 'Confirm payment'}
                  </button>
                </div>
              </div>
            )}
            {payment.failureReason && (
              <p className="finance-payment-reason">Review note: {payment.failureReason}</p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
