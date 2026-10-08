import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
const money = (value) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Date unavailable';

export default function FinanceDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/finance/dashboard', { signal: controller.signal })
      .then(({ data: dashboard }) => {
        if (!controller.signal.aborted) {
          setData(dashboard);
          setError('');
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError(requestError.response?.data?.message || 'Unable to load the billing dashboard.');
      });
    return () => controller.abort();
  }, [retry]);

  if (error)
    return (
      <main className="finance-dashboard">
        <header className="finance-dashboard-heading">
          <div>
            <p>FINANCE</p>
            <h1>Billing &amp; Revenue</h1>
          </div>
        </header>
        <div className="finance-dashboard-error" role="alert">
          {error}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Try again
          </button>
        </div>
      </main>
    );
  if (!data)
    return (
      <main className="finance-dashboard" role="status">
        <h1>Billing &amp; Revenue</h1>
        <p>Loading invoice and payment totals…</p>
      </main>
    );

  const { summary, revenueByMonth, recentPayments } = data;
  const maxRevenue = Math.max(1, ...revenueByMonth.map((month) => month.total));
  const cards = [
    { label: "Today's revenue", value: money(summary.todayRevenue), tone: 'green' },
    { label: 'Revenue this month', value: money(summary.monthlyRevenue), tone: 'blue' },
    {
      label: 'Total invoices',
      value: new Intl.NumberFormat().format(summary.totalInvoices),
      tone: 'purple',
    },
    { label: 'Outstanding value', value: money(summary.outstandingValue), tone: 'red' },
  ];

  return (
    <main className="finance-dashboard">
      <header className="finance-dashboard-heading">
        <div>
          <p>FINANCE</p>
          <h1>Billing &amp; Revenue</h1>
          <span>Revenue is based on finance-verified payments.</span>
        </div>
        <Link to="/finance/payments">Review payments</Link>
      </header>
      <section className="finance-dashboard-cards" aria-label="Revenue summary">
        {cards.map((card) => (
          <article className={`finance-dashboard-card ${card.tone}`} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>
      <section className="finance-invoice-statuses" aria-label="Invoice status totals">
        <article>
          <span>Paid invoices</span>
          <strong>{new Intl.NumberFormat().format(summary.paidInvoices)}</strong>
        </article>
        <article>
          <span>Pending / partially paid</span>
          <strong>{new Intl.NumberFormat().format(summary.pendingInvoices)}</strong>
        </article>
        <article>
          <span>Overdue invoices</span>
          <strong>{new Intl.NumberFormat().format(summary.overdueInvoices)}</strong>
        </article>
      </section>
      <div className="finance-dashboard-grid">
        <section className="section-card finance-revenue-chart">
          <header>
            <div>
              <h2>Revenue over the last six months</h2>
              <p>Completed payments, grouped by review month.</p>
            </div>
          </header>
          <svg
            viewBox="0 0 660 250"
            role="img"
            aria-label={`Six month revenue chart. ${revenueByMonth.map((month) => `${month.label}: ${money(month.total)}`).join('; ')}`}
          >
            {[0, 1, 2, 3].map((line) => (
              <g key={line}>
                <line x1="48" x2="640" y1={185 - line * 48} y2={185 - line * 48} />
                <text x="40" y={190 - line * 48}>
                  {money((maxRevenue * line) / 3)}
                </text>
              </g>
            ))}
            {revenueByMonth.map((month, index) => {
              const height = Math.max(month.total > 0 ? 3 : 0, (month.total / maxRevenue) * 138);
              const x = 78 + index * 94;
              return (
                <g key={`${month.year}-${month.month}`}>
                  <title>
                    {month.label} {month.year}: {money(month.total)}
                  </title>
                  <rect x={x} y={185 - height} width="48" height={height} rx="5" />
                  <text className="finance-chart-label" x={x + 24} y="211">
                    {month.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </section>
        <section className="section-card finance-recent-payments">
          <header>
            <div>
              <h2>Recent payments</h2>
              <p>Latest payment records, including verification status.</p>
            </div>
            <Link to="/finance/payments">All payments</Link>
          </header>
          {recentPayments.length ? (
            <ul>
              {recentPayments.map((payment) => (
                <li key={payment.id}>
                  <div>
                    <strong>{payment.customer}</strong>
                    <span>
                      {payment.invoiceNumber} · {payment.method}
                    </span>
                    <small>
                      {payment.reference} · {dateTime(payment.createdAt)}
                    </small>
                  </div>
                  <div>
                    <strong>{money(payment.amount)}</strong>
                    <span
                      className={`finance-payment-pill ${payment.status.toLowerCase().replaceAll(' ', '-')}`}
                    >
                      {payment.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="finance-dashboard-empty">No payment records yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
