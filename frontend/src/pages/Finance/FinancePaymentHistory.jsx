// Browse payment history with filters and pagination, and export or print the displayed finance data.
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { downloadFinanceCsv } from '../../lib/financeExport';
const methods = ['Cash', 'Card', 'Online', 'Bank Transfer', 'Pay at Workshop'];
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

export default function FinancePaymentHistory() {
  const [filters, setFilters] = useState({ search: '', method: '', from: '', to: '' });
  const [applied, setApplied] = useState({ search: '', method: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  // Load server data when these effect dependencies change; cleanup below prevents stale work from updating this view.
  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/admin/payments/history', {
        params: { page, limit: 25, ...applied },
        signal: controller.signal,
      })
      .then(({ data: history }) => {
        if (!controller.signal.aborted) {
          setData(history);
          setError('');
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError(requestError.response?.data?.message || 'Unable to load payment history.');
      });
    return () => controller.abort();
  }, [page, applied]);

  function applyFilters(event) {
    event.preventDefault();
    setPage(1);
    setApplied({ ...filters, search: filters.search.trim() });
  }

  async function downloadPaymentReport() {
    setExporting(true);
    try {
      const first = await api.get('/admin/payments/history', {
        params: { limit: 100, page: 1, ...applied },
      });
      const payments = [...first.data.payments];
      for (let start = 2; start <= first.data.totalPages; start += 10) {
        const pages = await Promise.all(
          Array.from({ length: Math.min(10, first.data.totalPages - start + 1) }, (_, index) =>
            api.get('/admin/payments/history', {
              params: { limit: 100, page: start + index, ...applied },
            }),
          ),
        );
        payments.push(...pages.flatMap((pageData) => pageData.data.payments));
      }
      downloadFinanceCsv(
        'finance-payment-report',
        [
          'Receipt',
          'Transaction reference',
          'Customer',
          'Invoice',
          'Amount (LKR)',
          'Method',
          'Status',
          'Submitted at',
          'Reviewed at',
        ],
        payments.map((payment) => [
          payment.receiptNumber,
          payment.transactionReference,
          payment.customer?.name,
          payment.invoice?.invoiceNumber,
          payment.amount,
          payment.method,
          payment.status,
          payment.createdAt,
          payment.reviewedAt,
        ]),
      );
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to download the payment report.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="finance-payment-history">
      <header className="finance-payment-history-heading">
        <div>
          <p>ADMIN · RECORDS</p>
          <h1>Payment history</h1>
          <span>Search and review recorded transactions.</span>
        </div>
        <div className="finance-payment-history-export">
          <strong>{data?.total ?? '—'} payments</strong>
          <button type="button" onClick={downloadPaymentReport} disabled={exporting}>
            {exporting ? 'Preparing…' : 'Download payment report (CSV)'}
          </button>
        </div>
      </header>
      <form className="finance-payment-history-filters section-card" onSubmit={applyFilters}>
        <label>
          Search
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            maxLength={100}
            placeholder="Receipt, transaction, customer or invoice"
          />
        </label>
        <label>
          Payment method
          <select
            value={filters.method}
            onChange={(event) =>
              setFilters((current) => ({ ...current, method: event.target.value }))
            }
          >
            <option value="">All methods</option>
            {methods.map((method) => (
              <option key={method}>{method}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={filters.from}
            onChange={(event) =>
              setFilters((current) => ({ ...current, from: event.target.value }))
            }
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
          />
        </label>
        <button type="submit">Apply filters</button>
      </form>
      {error && (
        <p className="finance-payment-history-error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="finance-payment-history-empty" role="status">
          Loading payment history…
        </p>
      )}
      {data?.payments.length === 0 && (
        <p className="finance-payment-history-empty">No payments match these filters.</p>
      )}
      {data?.payments.length > 0 && (
        <>
          <div className="finance-payment-history-table-wrap section-card">
            <table className="finance-payment-history-table">
              <thead>
                <tr>
                  <th>Receipt / transaction</th>
                  <th>Customer</th>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Payment date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>{payment.receiptNumber || 'Receipt pending'}</strong>
                      <small>{payment.transactionReference || 'No transaction reference'}</small>
                    </td>
                    <td>
                      <strong>{payment.customer?.name || 'Customer unavailable'}</strong>
                      <small>{payment.customer?.email || ''}</small>
                    </td>
                    <td>
                      <strong>{payment.invoice?.invoiceNumber || 'Invoice unavailable'}</strong>
                      <small>{payment.invoice?.paymentStatus || ''}</small>
                    </td>
                    <td>{money(payment.amount)}</td>
                    <td>{payment.method}</td>
                    <td>
                      <strong>{dateTime(payment.reviewedAt || payment.createdAt)}</strong>
                      <small>{payment.reviewedAt ? 'Reviewed' : 'Submitted'}</small>
                    </td>
                    <td>
                      <span
                        className={`finance-payment-history-status ${payment.status.toLowerCase().replaceAll(' ', '-')}`}
                      >
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="finance-payment-history-pagination">
            <span>
              Page {data.page} of {Math.max(1, data.totalPages)} · {data.total} records
            </span>
            <div>
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((value) => value + 1)}
                disabled={!data.totalPages || page >= data.totalPages}
              >
                Next
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
