import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import './CustomerInvoices.css';

const money = (value) =>
  value == null || !Number.isFinite(Number(value))
    ? 'Not provided'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'LKR',
        maximumFractionDigits: 2,
      }).format(Number(value));
const dateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
};
const vehicleName = (vehicle) =>
  vehicle
    ? `${vehicle.year ? `${vehicle.year} ` : ''}${vehicle.make} ${vehicle.model}${vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ''}`
    : 'Vehicle details unavailable';
const canPay = (status) => ['Pending', 'Partially Paid', 'Overdue'].includes(status);

function InvoiceCard({ invoice, printTarget, onPrint }) {
  return (
    <article
      className={`customer-invoice-card ${printTarget === invoice.id ? 'print-target' : ''}`}
    >
      <header className="invoice-card-header">
        <div>
          <p className="invoice-eyebrow">INVOICE {invoice.invoiceNumber}</p>
          <h2>{invoice.serviceType}</h2>
          <p>
            {invoice.serviceNumber} · {vehicleName(invoice.vehicle)}
          </p>
        </div>
        <span
          className={`invoice-status status-${invoice.paymentStatus.toLowerCase().replaceAll(' ', '-')}`}
        >
          {invoice.paymentStatus}
        </span>
      </header>
      <div className="invoice-meta">
        <span>Issued {dateTime(invoice.issuedAt)}</span>
        {invoice.paymentDate && <span>Paid {dateTime(invoice.paymentDate)}</span>}
        {invoice.paymentMethod && <span>Method: {invoice.paymentMethod}</span>}
      </div>
      {invoice.parts.length > 0 && (
        <section className="invoice-line-items">
          <h3>Parts</h3>
          <ul>
            {invoice.parts.map((part, index) => (
              <li key={`${part.name}-${index}`}>
                <span>
                  {part.name}
                  {part.partNumber ? ` · ${part.partNumber}` : ''}
                  {part.quantity != null ? ` × ${part.quantity}` : ''}
                </span>
                <strong>{money(part.total)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
      {invoice.labourItems.length > 0 && (
        <section className="invoice-line-items">
          <h3>Labour</h3>
          <ul>
            {invoice.labourItems.map((item, index) => (
              <li key={`${item.description}-${index}`}>
                <span>
                  {item.description}
                  {item.hours != null ? ` · ${item.hours} h` : ''}
                </span>
                <strong>{money(item.total)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
      <dl className="invoice-breakdown">
        <div>
          <dt>Parts charges</dt>
          <dd>{money(invoice.partsCost)}</dd>
        </div>
        <div>
          <dt>Labour charges</dt>
          <dd>{money(invoice.labourCost)}</dd>
        </div>
        {invoice.additionalRepairsCost > 0 && (
          <div>
            <dt>Additional repairs</dt>
            <dd>{money(invoice.additionalRepairsCost)}</dd>
          </div>
        )}
        <div>
          <dt>Tax</dt>
          <dd>{money(invoice.tax)}</dd>
        </div>
        {invoice.discount > 0 && (
          <div>
            <dt>Discount</dt>
            <dd>−{money(invoice.discount)}</dd>
          </div>
        )}
        <div className="invoice-grand-total">
          <dt>Total amount</dt>
          <dd>{money(invoice.totalAmount)}</dd>
        </div>
      </dl>
      <footer className="invoice-actions">
        <button type="button" className="invoice-print-button" onClick={() => onPrint(invoice.id)}>
          Print / Save PDF
        </button>
        {canPay(invoice.paymentStatus) && (
          <Link
            className="invoice-pay-button"
            to={`/customer/payments?invoice=${encodeURIComponent(invoice.id)}`}
          >
            Proceed to payment
          </Link>
        )}
      </footer>
    </article>
  );
}

export default function CustomerInvoices() {
  const [invoices, setInvoices] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [printTarget, setPrintTarget] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/customer-invoices', { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setInvoices(data);
          setError('');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.response?.data?.message || 'Unable to load your invoices.');
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const afterPrint = () => setPrintTarget('');
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, []);
  const print = (id) => {
    setPrintTarget(id);
    window.setTimeout(() => window.print(), 120);
  };
  const outstanding = (invoices || []).filter((invoice) => canPay(invoice.paymentStatus)).length;

  return (
    <main className="customer-invoices-page">
      <header className="invoices-page-heading">
        <div>
          <p className="invoice-eyebrow">ACCOUNT</p>
          <h1>Invoices</h1>
          <p>Review service charges and payment status.</p>
        </div>
        <span>{outstanding} outstanding</span>
      </header>
      {error && (
        <div className="invoice-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {invoices === null && !error && (
        <p className="invoice-loading" role="status">
          Loading invoices…
        </p>
      )}
      {invoices?.length === 0 && (
        <section className="invoice-empty">
          <h2>No invoices available</h2>
          <p>Invoices will appear here when the workshop issues them.</p>
          <Link to="/customer/history">View service history</Link>
        </section>
      )}
      <div className="customer-invoice-list">
        {invoices?.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            printTarget={printTarget}
            onPrint={print}
          />
        ))}
      </div>
    </main>
  );
}
