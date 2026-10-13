// Review completed work and invoices, save or edit drafts, issue invoices, and delete drafts through billing API actions.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { invoiceStatus } from '../../lib/serviceStatus';
import { downloadFinanceCsv } from '../../lib/financeExport';

const statuses = ['Draft', 'Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];

const money = (value) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const date = (value) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';
const timestamp = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded';
const roundMoney = value => Math.round(value * 100) / 100;

export default function FinanceInvoices() {
  const [invoices, setInvoices] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [rateOverrides, setRateOverrides] = useState({});
  const [chargeOverrides, setChargeOverrides] = useState({});
  const [lineOverrides, setLineOverrides] = useState({});
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Load server data when these effect dependencies change; cleanup below prevents stale work from updating this view.
  useEffect(() => {
    let active = true;
    api
      .get('/admin/invoices')
      .then(({ data }) => {
        if (active) {
          const loaded = data.invoices || [];
          setInvoices(loaded);
          setSelectedId(loaded[0]?.id || '');
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load invoices.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const afterPrint = () => setPrinting(false);
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, []);

  const draftCount = useMemo(
    () => (invoices || []).filter((inv) => inv.paymentStatus === 'Draft').length,
    [invoices],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (invoices || []).filter((invoice) => {
      const matchesStatus =
        statusFilter === 'All statuses' || invoice.paymentStatus === statusFilter;
      const searchable = [
        invoice.invoiceNumber,
        invoice.customer?.name,
        invoice.customer?.email,
        invoice.customer?.mobile,
        invoice.serviceJob?.serviceNumber,
        invoice.serviceJob?.vehicle?.registrationNumber,
        invoice.serviceJob?.vehicle?.make,
        invoice.serviceJob?.vehicle?.model,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [invoices, search, statusFilter]);

  const invoice = (invoices || []).find((item) => item.id === selectedId);
  const charge = chargeOverrides[invoice?.id] || {};
  const adminChargeDescription = charge.description ?? invoice?.adminChargeDescription ?? '';
  const adminChargeAmount = charge.amount ?? String(invoice?.adminChargeAmount || 0);
  const pricedParts = lineOverrides[invoice?.id]?.parts || invoice?.parts || [];
  const pricedLabour = lineOverrides[invoice?.id]?.labourItems || invoice?.labourItems || [];
  const partsCost = roundMoney(pricedParts.reduce((sum, part) => sum + roundMoney(Number(part.quantity) * roundMoney(Number(part.unitPrice))), 0));
  const labourCost = roundMoney(pricedLabour.reduce((sum, item) => sum + roundMoney(Number(item.hours) * roundMoney(Number(item.rate))), 0));
  const base = invoice ? partsCost + labourCost + (invoice.additionalRepairsCost || 0) + (Number(adminChargeAmount) || 0) : 0;
  const savedBase = invoice ? (invoice.partsCost || 0) + (invoice.labourCost || 0) + (invoice.additionalRepairsCost || 0) + (invoice.adminChargeAmount || 0) : 0;
  const rates = rateOverrides[invoice?.id] || {};
  const discountRate =
    rates.discountRate ?? (savedBase ? String(Math.round(((Number(invoice?.discount || 0) / savedBase) * 100) * 100) / 100) : '0');
  const taxable = Math.max(0, savedBase - (Number(invoice?.discount) || 0));
  const taxRate =
    rates.taxRate ?? (taxable ? String(Math.round(((Number(invoice?.tax || 0) / taxable) * 100) * 100) / 100) : '0');
  const previewDiscount = Math.round(base * (Number(discountRate) || 0)) / 100;
  const previewTax = Math.round(Math.max(0, base - previewDiscount) * (Number(taxRate) || 0)) / 100;
  const previewTotal = Math.round((base - previewDiscount + previewTax) * 100) / 100;

  function changeLine(kind, index, field, value) {
    setLineOverrides(current => {
      const rows = current[invoice.id]?.[kind] || invoice[kind] || [];
      return { ...current, [invoice.id]: { ...current[invoice.id], [kind]: rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row) } };
    });
  }

  function changeLabour(rows) {
    setLineOverrides(current => ({ ...current, [invoice.id]: { ...current[invoice.id], labourItems: rows } }));
  }

  async function updateInvoice(finalize) {
    if (!invoice) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      // Request a server-side change; update the displayed state from the successful response below.
      const { data } = await api.patch(`/admin/invoices/${invoice.id}`, {
        taxRate: Number(taxRate) || 0,
        discountRate: Number(discountRate) || 0,
        adminChargeDescription,
        adminChargeAmount: Number(adminChargeAmount) || 0,
        parts: pricedParts.map(part => ({ ...part, unitPrice: Number(part.unitPrice) })),
        labourItems: pricedLabour.map(item => ({ ...item, hours: Number(item.hours), rate: Number(item.rate) })),
        finalize,
      });
      setInvoices((current) =>
        current.map((item) =>
          item.id === invoice.id
            ? {
                ...item,
                ...data.invoice,
                amountDue: Math.max(0, data.invoice.totalAmount - (item.amountPaid || 0)),
              }
            : item,
        ),
      );
      setNotice(data.message || (finalize ? 'Invoice finalized and issued to customer successfully.' : 'Draft saved.'));
      setLineOverrides(current => { const next = { ...current }; delete next[invoice.id]; return next; });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this invoice.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteInvoice() {
    if (
      !invoice ||
      !window.confirm(`Delete draft ${invoice.invoiceNumber}? This cannot be undone.`)
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      // Ask the server to remove this record; server-side checks decide whether deletion is allowed.
      const { data } = await api.delete(`/admin/invoices/${invoice.id}`);
      const remaining = invoices.filter((item) => item.id !== invoice.id);
      setInvoices(remaining);
      setSelectedId(remaining[0]?.id || '');
      setNotice(data.message || 'Draft invoice deleted.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete this draft invoice.');
    } finally {
      setBusy(false);
    }
  }

  function downloadInvoiceReport() {
    downloadFinanceCsv(
      'finance-invoice-report',
      [
        'Invoice',
        'Issue date',
        'Customer',
        'Service job',
        'Status',
        'Total (LKR)',
        'Paid (LKR)',
        'Due (LKR)',
      ],
      filtered.map((item) => [
        item.invoiceNumber,
        item.issuedAt,
        item.customer?.name,
        item.serviceJob?.serviceNumber,
        item.paymentStatus,
        item.totalAmount,
        item.amountPaid,
        item.amountDue,
      ]),
    );
  }

  if (invoices === null && !error) {
    return (
      <main className="finance-invoice-management">
        <header className="finance-invoice-management-heading">
          <div>
            <p>ADMIN · BILLING</p>
            <h1>Invoice management</h1>
          </div>
        </header>
        <p role="status">Loading invoices…</p>
      </main>
    );
  }

  return (
    <main className={`finance-invoice-management ${printing ? 'printing' : ''}`}>
      <header className="finance-invoice-management-heading">
        <div>
          <p>ADMIN · BILLING</p>
          <h1>Invoice management</h1>
          <span>
            Review draft invoices from completed jobs, adjust taxes & discounts, issue invoices, and manage payment statuses.
          </span>
        </div>
        <strong>{invoices?.length || 0} total invoices</strong>
      </header>

      {draftCount > 0 && statusFilter !== 'Draft' && (
        <div className="section-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1.1rem', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⚡</span>
            <div>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                {draftCount} Draft invoice{draftCount > 1 ? 's' : ''} awaiting review
              </strong>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                Automatically generated from completed technician job reports.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            style={{ background: '#eab308', color: '#000', fontWeight: '700', padding: '0.35rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
            onClick={() => {
              setStatusFilter('Draft');
              const firstDraft = invoices.find((i) => i.paymentStatus === 'Draft');
              if (firstDraft) setSelectedId(firstDraft.id);
            }}
          >
            Review drafts
          </button>
        </div>
      )}

      {error && (
        <p className="finance-invoice-message error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="finance-invoice-message success" role="status">
          {notice}
        </p>
      )}

      <section className="finance-invoice-search section-card">
        <label>
          Search invoices
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by invoice #, customer, job, or vehicle..."
          />
        </label>
        <label>
          Payment status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option>All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {invoiceStatus(status)}
              </option>
            ))}
          </select>
        </label>
      </section>

      {!invoices?.length ? (
        <section className="finance-invoice-empty section-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <h2>No invoices recorded yet</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Invoices are automatically created as drafts when technicians complete service job cards.
          </p>
        </section>
      ) : (
        <div className="finance-invoice-management-grid">
          <section className="finance-invoice-list section-card">
            <div className="finance-invoice-list-heading">
              <h2>Invoices</h2>
              <span>{filtered.length} shown</span>
              <button type="button" onClick={downloadInvoiceReport} disabled={!filtered.length}>
                Download CSV
              </button>
            </div>
            {filtered.length ? (
              <div className="finance-invoice-table-wrap">
                <table className="finance-invoice-list-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Customer / Job</th>
                      <th>Total</th>
                      <th>Due</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr
                        key={item.id}
                        className={selectedId === item.id ? 'selected' : ''}
                        onClick={() => {
                          setSelectedId(item.id);
                          setNotice('');
                        }}
                        tabIndex="0"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') setSelectedId(item.id);
                        }}
                      >
                        <td>
                          <strong>{item.invoiceNumber}</strong>
                          <small>{date(item.issuedAt || item.createdAt)}</small>
                        </td>
                        <td>
                          <strong>{item.customer?.name || 'Customer'}</strong>
                          <small>{item.serviceJob?.serviceNumber || 'Job'}</small>
                        </td>
                        <td>{money(item.totalAmount)}</td>
                        <td>{money(item.amountDue)}</td>
                        <td>
                          <span
                            className={`finance-invoice-state ${item.paymentStatus.toLowerCase().replaceAll(' ', '-')}`}
                          >
                            {invoiceStatus(item.paymentStatus)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="finance-invoice-empty-filter">No invoices match your search filters.</p>
            )}
          </section>

          {invoice && (
            <section className="finance-invoice-detail section-card">
              <div className="finance-invoice-preview-heading">
                <div>
                  <span>INVOICE DETAILS</span>
                  <h2>{invoice.invoiceNumber}</h2>
                  <p>
                    Job {invoice.serviceJob?.serviceNumber || '—'} · {invoice.paymentStatus === 'Draft' ? 'Created ' : 'Issued '} {date(invoice.issuedAt || invoice.createdAt)}
                  </p>
                </div>
                <span
                  className={`finance-invoice-state ${invoice.paymentStatus.toLowerCase().replaceAll(' ', '-')}`}
                >
                  {invoiceStatus(invoice.paymentStatus)}
                </span>
              </div>

              <div className="finance-invoice-parties">
                <div>
                  <small>BILL TO</small>
                  <strong>{invoice.customer?.name || 'Customer details unavailable'}</strong>
                  <span>{invoice.customer?.email || ''}</span>
                  <span>{invoice.customer?.mobile || ''}</span>
                </div>
                <div>
                  <small>VEHICLE / SERVICE</small>
                  <strong>
                    {[
                      invoice.serviceJob?.vehicle?.year,
                      invoice.serviceJob?.vehicle?.make,
                      invoice.serviceJob?.vehicle?.model,
                    ]
                      .filter(Boolean)
                      .join(' ') || 'Vehicle details unavailable'}
                  </strong>
                  <span>
                    {invoice.serviceJob?.vehicle?.registrationNumber || 'Registration unavailable'}
                  </span>
                  <span>
                    {invoice.serviceJob?.serviceType || 'Service repair'} ·{' '}
                    {invoice.serviceJob?.serviceNumber}
                  </span>
                </div>
              </div>

              <section className="admin-pricing-timing">
                <h3>Completed work & recorded time</h3>
                <p>Started: {timestamp(invoice.serviceJob?.startedAt)} · Completed: {timestamp(invoice.serviceJob?.completedAt)}</p>
                <p>Recorded duration: {invoice.serviceJob?.durationHours == null ? 'Not recorded' : `${Number(invoice.serviceJob.durationHours).toFixed(2)} hours`}</p>
                {invoice.serviceJob?.workDone?.length > 0 && <ul>{invoice.serviceJob.workDone.map((work, index) => <li key={index}>{work}</li>)}</ul>}
              </section>

              <div className="admin-data-table-wrap">
                <table className="admin-data-table admin-invoice-pricing-table">
                  <thead><tr><th>Spare part</th><th>Quantity</th><th>Unit price (LKR)</th><th>Total</th></tr></thead>
                  <tbody>
                    {pricedParts.map((part, index) => <tr key={`part-${index}`}>
                      <td>{part.name}<small>{part.partNumber}</small></td>
                      <td>{part.quantity}</td>
                      <td>{invoice.paymentStatus === 'Draft' ? <input aria-label={`Unit price for ${part.name}`} type="number" min="0" max="100000000" step="0.01" value={part.unitPrice} disabled={busy} onChange={event => changeLine('parts', index, 'unitPrice', event.target.value)} /> : money(part.unitPrice)}</td>
                      <td>{money(roundMoney(Number(part.quantity) * Number(part.unitPrice)))}</td>
                    </tr>)}
                    {!pricedParts.length && <tr><td colSpan="4">No spare parts recorded.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="admin-data-table-wrap">
                <table className="admin-data-table admin-invoice-pricing-table">
                  <thead><tr><th>Hourly labour</th><th>Hours</th><th>Hourly rate (LKR)</th><th>Total</th><th>Actions</th></tr></thead>
                  <tbody>
                    {pricedLabour.map((item, index) => <tr key={`labour-${index}`}>
                      <td>{invoice.paymentStatus === 'Draft' ? <input aria-label={`Labour description ${index + 1}`} maxLength={200} value={item.description} disabled={busy} onChange={event => changeLine('labourItems', index, 'description', event.target.value)} /> : item.description}</td>
                      <td>{invoice.paymentStatus === 'Draft' ? <input aria-label={`Labour hours ${index + 1}`} type="number" min="0" max="8760" step="any" value={item.hours} disabled={busy} onChange={event => changeLine('labourItems', index, 'hours', event.target.value)} /> : item.hours}</td>
                      <td>{invoice.paymentStatus === 'Draft' ? <input aria-label={`Hourly rate ${index + 1}`} type="number" min="0" max="100000000" step="0.01" value={item.rate} disabled={busy} onChange={event => changeLine('labourItems', index, 'rate', event.target.value)} /> : money(item.rate)}</td>
                      <td>{money(roundMoney(Number(item.hours) * Number(item.rate)))}</td>
                      <td>{invoice.paymentStatus === 'Draft' && <button type="button" className="btn-outline" disabled={busy} onClick={() => changeLabour(pricedLabour.filter((_, row) => row !== index))}>Remove</button>}</td>
                    </tr>)}
                    {!pricedLabour.length && <tr><td colSpan="5">No hourly labour charges.</td></tr>}
                  </tbody>
                </table>
              </div>
              {invoice.paymentStatus === 'Draft' && <div className="admin-pricing-actions">
                <button type="button" className="btn-outline" disabled={busy} onClick={() => changeLabour([...pricedLabour, { description: 'Labour', hours: 0, rate: 0 }])}>Add hourly labour</button>
                <button type="button" className="btn-outline" disabled={busy || invoice.serviceJob?.durationHours == null} onClick={() => changeLabour([{ description: 'Labour for recorded job duration', hours: invoice.serviceJob.durationHours, rate: pricedLabour[0]?.rate || 0 }])}>Use recorded job duration</button>
              </div>}

              <div className="finance-invoice-bottom">
                <div className="finance-invoice-adjustments">
                  <label>
                    Service charge description
                    <input type="text" maxLength="200" value={adminChargeDescription} onChange={(event) => setChargeOverrides((current) => ({ ...current, [invoice.id]: { ...current[invoice.id], description: event.target.value } }))} disabled={busy || invoice.paymentStatus !== 'Draft'} placeholder="e.g. Additional labour" />
                  </label>
                  <label>
                    Service amount (LKR)
                    <input type="number" min="0" max="100000000" step="0.01" value={adminChargeAmount} onChange={(event) => setChargeOverrides((current) => ({ ...current, [invoice.id]: { ...current[invoice.id], amount: event.target.value } }))} disabled={busy || invoice.paymentStatus !== 'Draft'} />
                  </label>
                  <label>
                    Discount (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={discountRate}
                      onChange={(event) =>
                        setRateOverrides((current) => ({
                          ...current,
                          [invoice.id]: {
                            ...current[invoice.id],
                            discountRate: event.target.value,
                          },
                        }))
                      }
                      disabled={busy || invoice.paymentStatus !== 'Draft'}
                    />
                  </label>
                  <label>
                    Tax (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={taxRate}
                      onChange={(event) =>
                        setRateOverrides((current) => ({
                          ...current,
                          [invoice.id]: { ...current[invoice.id], taxRate: event.target.value },
                        }))
                      }
                      disabled={busy || invoice.paymentStatus !== 'Draft'}
                    />
                  </label>
                  {invoice.paymentStatus !== 'Draft' && (
                    <div className="finance-invoice-payment-status">
                      <strong>Amount paid: {money(invoice.amountPaid)}</strong>
                      <br />
                      <strong>Amount due: {money(invoice.amountDue)}</strong>
                      {invoice.paymentMethod ? (
                        <>
                          <br />
                          <span>Method: {invoice.paymentMethod}</span>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>

                <dl className="finance-invoice-totals">
                  <div>
                    <dt>Parts</dt>
                    <dd>{money(partsCost)}</dd>
                  </div>
                  <div>
                    <dt>Labour</dt>
                    <dd>{money(labourCost)}</dd>
                  </div>
                  {Number(invoice.additionalRepairsCost) > 0 && (
                    <div>
                      <dt>Approved additional repairs</dt>
                      <dd>{money(invoice.additionalRepairsCost)}</dd>
                    </div>
                  )}
                  {Number(adminChargeAmount) > 0 && (
                    <div><dt>{adminChargeDescription || 'Workshop charge'}</dt><dd>{money(adminChargeAmount)}</dd></div>
                  )}
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{money(base)}</dd>
                  </div>
                  <div>
                    <dt>Discount ({Number(discountRate) || 0}%)</dt>
                    <dd>
                      −
                      {money(
                        invoice.paymentStatus === 'Draft' ? previewDiscount : invoice.discount,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Tax ({Number(taxRate) || 0}%)</dt>
                    <dd>{money(invoice.paymentStatus === 'Draft' ? previewTax : invoice.tax)}</dd>
                  </div>
                  <div className="grand-total">
                    <dt>Total</dt>
                    <dd>
                      {money(
                        invoice.paymentStatus === 'Draft' ? previewTotal : invoice.totalAmount,
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <footer className="finance-invoice-actions">
                <span>All amounts in LKR · Status: {invoiceStatus(invoice.paymentStatus)}</span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setPrinting(true);
                    window.setTimeout(() => window.print(), 120);
                  }}
                >
                  Print / Download PDF
                </button>
                {invoice.paymentStatus === 'Draft' && (
                  <>
                    <button
                      type="button"
                      className="secondary danger"
                      onClick={deleteInvoice}
                      disabled={busy}
                    >
                      Delete draft
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => updateInvoice(false)}
                      disabled={busy}
                    >
                      {busy ? 'Saving…' : 'Save draft changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateInvoice(true)}
                      disabled={busy}
                      style={{ background: '#7655c8', color: '#fff', fontWeight: '700' }}
                    >
                      {busy ? 'Issuing…' : 'Finalize and issue'}
                    </button>
                  </>
                )}
              </footer>

              <div className="finance-print-sheet">
                <p>VEHICLE SERVICE · INVOICE</p>
                <h1>{invoice.invoiceNumber}</h1>
                <p>
                  Issued {date(invoice.issuedAt || invoice.createdAt)} · Status: {invoiceStatus(invoice.paymentStatus)}
                </p>
                <hr />
                <h2>Bill to</h2>
                <p>
                  {invoice.customer?.name}
                  <br />
                  {invoice.customer?.email}
                  <br />
                  {invoice.customer?.mobile}
                </p>
                <h2>Service</h2>
                <p>
                  {invoice.serviceJob?.serviceNumber} · {invoice.serviceJob?.serviceType}
                  <br />
                  {[
                    invoice.serviceJob?.vehicle?.year,
                    invoice.serviceJob?.vehicle?.make,
                    invoice.serviceJob?.vehicle?.model,
                    invoice.serviceJob?.vehicle?.registrationNumber,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty / Hours</th>
                      <th>Rate</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.parts || []).map((part, index) => (
                      <tr key={`p${index}`}>
                        <td>{part.name}</td>
                        <td>{part.quantity}</td>
                        <td>{money(part.unitPrice)}</td>
                        <td>{money(part.total)}</td>
                      </tr>
                    ))}
                    {(invoice.labourItems || []).map((item, index) => (
                      <tr key={`l${index}`}>
                        <td>{item.description} · Labour</td>
                        <td>{item.hours} h</td>
                        <td>{money(item.rate)}/h</td>
                        <td>{money(item.total)}</td>
                      </tr>
                    ))}
                    {Number(invoice.additionalRepairsCost) > 0 && (
                      <tr>
                        <td>Approved additional repairs</td>
                        <td>—</td>
                        <td>—</td>
                        <td>{money(invoice.additionalRepairsCost)}</td>
                      </tr>
                    )}
                    {Number(invoice.adminChargeAmount) > 0 && (
                      <tr><td>{invoice.adminChargeDescription || 'Workshop charge'}</td><td>—</td><td>—</td><td>{money(invoice.adminChargeAmount)}</td></tr>
                    )}
                  </tbody>
                </table>
                <p>
                  Parts: {money(invoice.partsCost)} · Labour: {money(invoice.labourCost)}
                </p>
                <p>
                  Subtotal: {money(base)} · Discount: −{money(invoice.discount)} · Tax:{' '}
                  {money(invoice.tax)}
                </p>
                <h2>Total: {money(invoice.totalAmount)}</h2>
                <p>
                  Paid: {money(invoice.amountPaid)} · Balance due: {money(invoice.amountDue)}
                </p>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
