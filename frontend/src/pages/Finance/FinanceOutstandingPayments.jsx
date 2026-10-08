import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { downloadFinanceCsv } from '../../lib/financeExport';
import './FinanceOutstandingPayments.css';

const money = (value) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
const date = (value) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';
const methods = ['Cash', 'Card', 'Online', 'Bank Transfer', 'Pay at Workshop'];

export default function FinanceOutstandingPayments() {
  const [data, setData] = useState(null);
  const [expandedId, setExpandedId] = useState('');
  const [methodsByInvoice, setMethodsByInvoice] = useState({});
  const [references, setReferences] = useState({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/finance/payments/outstanding', { signal: controller.signal })
      .then(({ data: outstanding }) => {
        if (!controller.signal.aborted) {
          setData(outstanding);
          setError('');
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError(requestError.response?.data?.message || 'Unable to load outstanding invoices.');
      });
    return () => controller.abort();
  }, [retry]);

  async function sendReminder(invoice) {
    setBusyId(invoice.id);
    setError('');
    setNotice('');
    try {
      const { data: result } = await api.post(`/finance/payments/${invoice.id}/reminder`);
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to send the payment reminder.');
    } finally {
      setBusyId('');
    }
  }

  async function markPaid(event, invoice) {
    event.preventDefault();
    setBusyId(invoice.id);
    setError('');
    setNotice('');
    const method = methodsByInvoice[invoice.id] || 'Cash';
    try {
      const { data: result } = await api.post('/finance/payments/record', {
        invoiceId: invoice.id,
        amount: invoice.amountDue,
        method,
        transactionReference: references[invoice.id] || '',
      });
      setNotice(
        `${result.message} Receipt ${result.payment.receiptNumber}${result.receiptEmailSent ? ' emailed to customer.' : '.'}`,
      );
      setExpandedId('');
      setData((current) => {
        const invoices = current.invoices.filter((item) => item.id !== invoice.id);
        return {
          ...current,
          invoices,
          summary: {
            totalOutstanding:
              Math.round(invoices.reduce((sum, item) => sum + item.amountDue, 0) * 100) / 100,
            unpaidInvoices: invoices.filter((item) => item.paymentStatus !== 'Overdue').length,
            overdueInvoices: invoices.filter((item) => item.paymentStatus === 'Overdue').length,
          },
        };
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to record payment.');
    } finally {
      setBusyId('');
    }
  }

  function downloadOutstandingReport() {
    if (!data) return;
    downloadFinanceCsv(
      'finance-outstanding-payments-report',
      [
        'Invoice',
        'Customer',
        'Service job',
        'Vehicle',
        'Status',
        'Issued at',
        'Due date',
        'Overdue days',
        'Total (LKR)',
        'Paid (LKR)',
        'Due (LKR)',
      ],
      data.invoices.map((invoice) => [
        invoice.invoiceNumber,
        invoice.customer?.name,
        invoice.serviceNumber,
        invoice.vehicle,
        invoice.paymentStatus,
        invoice.issuedAt,
        invoice.dueDate,
        invoice.overdueDays,
        invoice.totalAmount,
        invoice.amountPaid,
        invoice.amountDue,
      ]),
    );
  }

  const renderRows = (invoices, overdue) =>
    invoices.map((invoice) => (
      <article className={`finance-outstanding-row ${overdue ? 'overdue' : ''}`} key={invoice.id}>
        <div className="finance-outstanding-invoice">
          <strong>{invoice.invoiceNumber}</strong>
          <span>
            {invoice.serviceNumber || 'Service job'}
            {invoice.vehicle ? ` · ${invoice.vehicle}` : ''}
          </span>
          <small>
            Issued {date(invoice.issuedAt)} · Due {date(invoice.dueDate)}
          </small>
        </div>
        <div className="finance-outstanding-customer">
          <strong>{invoice.customer?.name || 'Customer details unavailable'}</strong>
          <span>{invoice.customer?.email || 'No email recorded'}</span>
          {invoice.customer?.mobile && <small>{invoice.customer.mobile}</small>}
        </div>
        <div className="finance-outstanding-balance">
          <span>Balance due</span>
          <strong>{money(invoice.amountDue)}</strong>
          <small>
            {overdue
              ? `${invoice.overdueDays} day${invoice.overdueDays === 1 ? '' : 's'} overdue`
              : invoice.paymentStatus}
          </small>
        </div>
        <div className="finance-outstanding-actions">
          <button
            type="button"
            className="reminder"
            disabled={busyId === invoice.id || !invoice.customer?.email}
            onClick={() => sendReminder(invoice)}
          >
            {busyId === invoice.id ? 'Sending…' : 'Send reminder'}
          </button>
          <button
            type="button"
            onClick={() => setExpandedId((current) => (current === invoice.id ? '' : invoice.id))}
            disabled={busyId === invoice.id}
          >
            {expandedId === invoice.id ? 'Close' : 'Mark manually paid'}
          </button>
        </div>
        {expandedId === invoice.id && (
          <form
            className="finance-outstanding-record-form"
            onSubmit={(event) => markPaid(event, invoice)}
          >
            <p>
              Record full balance of <strong>{money(invoice.amountDue)}</strong> for{' '}
              {invoice.invoiceNumber}.
            </p>
            <label>
              Payment method
              <select
                value={methodsByInvoice[invoice.id] || 'Cash'}
                onChange={(event) =>
                  setMethodsByInvoice((current) => ({
                    ...current,
                    [invoice.id]: event.target.value,
                  }))
                }
              >
                {methods.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </label>
            <label>
              Transaction reference
              {['Card', 'Online', 'Bank Transfer'].includes(methodsByInvoice[invoice.id] || 'Cash')
                ? ' (required)'
                : ' (optional)'}
              <input
                value={references[invoice.id] || ''}
                onChange={(event) =>
                  setReferences((current) => ({ ...current, [invoice.id]: event.target.value }))
                }
                required={['Card', 'Online', 'Bank Transfer'].includes(
                  methodsByInvoice[invoice.id] || 'Cash',
                )}
                minLength={
                  ['Card', 'Online', 'Bank Transfer'].includes(
                    methodsByInvoice[invoice.id] || 'Cash',
                  )
                    ? 3
                    : undefined
                }
                maxLength={100}
              />
            </label>
            <button type="submit" disabled={busyId === invoice.id}>
              {busyId === invoice.id ? 'Recording…' : 'Record payment and receipt'}
            </button>
          </form>
        )}
      </article>
    ));

  return (
    <main className="finance-outstanding-payments">
      <header className="finance-outstanding-heading">
        <div>
          <p>FINANCE · COLLECTIONS</p>
          <h1>Outstanding payments</h1>
          <span>Track balances, remind customers, and record manually received payments.</span>
        </div>
        <div className="finance-outstanding-export-actions">
          <button
            type="button"
            onClick={downloadOutstandingReport}
            disabled={!data?.invoices.length}
          >
            Download outstanding report (CSV)
          </button>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Refresh
          </button>
        </div>
      </header>
      {error && (
        <div className="finance-outstanding-alert error" role="alert">
          {error}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {notice && (
        <div className="finance-outstanding-alert success" role="status">
          {notice}
        </div>
      )}
      {!data && !error && (
        <p className="finance-outstanding-empty" role="status">
          Loading outstanding balances…
        </p>
      )}
      {data && (
        <>
          <section className="finance-outstanding-summary">
            <article>
              <span>Total outstanding</span>
              <strong>{money(data.summary.totalOutstanding)}</strong>
            </article>
            <article>
              <span>Unpaid invoices</span>
              <strong>{data.summary.unpaidInvoices}</strong>
            </article>
            <article>
              <span>Overdue invoices</span>
              <strong>{data.summary.overdueInvoices}</strong>
            </article>
          </section>
          <section className="finance-outstanding-section">
            <header>
              <h2>Overdue invoices</h2>
              <span>{data.summary.overdueInvoices}</span>
            </header>
            {data.invoices.filter((invoice) => invoice.paymentStatus === 'Overdue').length ? (
              renderRows(
                data.invoices.filter((invoice) => invoice.paymentStatus === 'Overdue'),
                true,
              )
            ) : (
              <p className="finance-outstanding-empty">No overdue invoices.</p>
            )}
          </section>
          <section className="finance-outstanding-section">
            <header>
              <h2>Unpaid invoices</h2>
              <span>{data.summary.unpaidInvoices}</span>
            </header>
            {data.invoices.filter((invoice) => invoice.paymentStatus !== 'Overdue').length ? (
              renderRows(
                data.invoices.filter((invoice) => invoice.paymentStatus !== 'Overdue'),
                false,
              )
            ) : (
              <p className="finance-outstanding-empty">No unpaid invoices.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
