import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import FinanceInvoiceManagement from './FinanceInvoiceManagement';
import './FinanceInvoices.css';

const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'LKR', maximumFractionDigits: 2 }).format(Number(value) || 0);
const date = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'Date unavailable';

export default function FinanceInvoices() {
  const [mode, setMode] = useState('manage');
  const [jobs, setJobs] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [rateOverrides, setRateOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/finance/invoices/jobs').then(({ data }) => {
      if (!active) return;
      const readyJobs = data.jobs || [];
      setJobs(readyJobs);
      setSelectedId(current => current || readyJobs[0]?.id || '');
    }).catch(requestError => {
      if (active) setError(requestError.response?.data?.message || 'Unable to load completed jobs for billing.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const job = jobs.find(item => item.id === selectedId);
  const savedDiscount = Number(job?.invoice?.discount || 0);
  const savedTaxBase = Math.max(0, (job?.subtotal || 0) - savedDiscount);
  const taxRate = rateOverrides[job?.id]?.taxRate ?? (savedTaxBase ? String(Math.min(100, Number(job?.invoice?.tax || 0) / savedTaxBase * 100)) : '0');
  const discountRate = rateOverrides[job?.id]?.discountRate ?? (job?.subtotal ? String(Math.min(100, savedDiscount / job.subtotal * 100)) : '0');

  const totals = useMemo(() => {
    if (!job) return { discount: 0, tax: 0, total: 0 };
    const subtotal = Number(job.subtotal) || 0;
    const discount = Math.round(subtotal * (Number(discountRate) || 0)) / 100;
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * (Number(taxRate) || 0)) / 100;
    return { discount, tax, total: Math.round((taxable + tax) * 100) / 100 };
  }, [job, discountRate, taxRate]);

  async function saveInvoice(finalize) {
    if (!job) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post(`/finance/invoices/jobs/${job.id}/invoice`, { taxRate: Number(taxRate) || 0, discountRate: Number(discountRate) || 0, finalize });
      setJobs(current => current.map(item => item.id === job.id ? { ...item, invoice: { ...item.invoice, ...data.invoice } } : item));
      setNotice(data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save this invoice.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'manage') return <div className="finance-invoices"><nav className="finance-invoice-tabs" aria-label="Invoice actions"><button type="button" className="active" aria-current="page">Manage invoices</button><button type="button" onClick={() => setMode('generate')}>Generate invoice</button></nav><FinanceInvoiceManagement /></div>;
  if (loading) return <main className="finance-invoices"><nav className="finance-invoice-tabs" aria-label="Invoice actions"><button type="button" onClick={() => setMode('manage')}>Manage invoices</button><button type="button" className="active" aria-current="page">Generate invoice</button></nav><h1>Generate invoice</h1><p role="status">Loading completed jobs…</p></main>;
  return <main className="finance-invoices">
    <nav className="finance-invoice-tabs" aria-label="Invoice actions"><button type="button" onClick={() => setMode('manage')}>Manage invoices</button><button type="button" className="active" aria-current="page">Generate invoice</button></nav>
    <header className="finance-invoices-heading"><div><p>FINANCE · BILLING</p><h1>Generate invoice</h1><span>Review completed work, adjust tax and discount, then save or issue the invoice.</span></div></header>
    {error && <p className="finance-invoice-message error" role="alert">{error}</p>}
    {notice && <p className="finance-invoice-message success" role="status">{notice}</p>}
    {!jobs.length ? <section className="finance-invoice-empty"><h2>No completed jobs are ready for billing</h2><p>Jobs appear here after the technician completes the final report.</p></section> : <div className="finance-invoice-workspace">
      <aside className="finance-invoice-job-list" aria-label="Completed service jobs">
        <h2>Completed jobs <span>{jobs.length}</span></h2>
        {jobs.map(item => <button type="button" key={item.id} className={selectedId === item.id ? 'selected' : ''} onClick={() => setSelectedId(item.id)}><strong>{item.serviceNumber}</strong><span>{item.vehicle?.registrationNumber || 'Vehicle'} · {item.customer?.name || 'Customer'}</span><small>{item.invoice ? `${item.invoice.invoiceNumber} · ${item.invoice.paymentStatus}` : 'No invoice yet'}</small></button>)}
      </aside>
      {job && <section className="finance-invoice-preview" aria-label="Invoice preview">
        <div className="finance-invoice-preview-heading"><div><span>INVOICE PREVIEW</span><h2>{job.invoice?.invoiceNumber || 'New draft invoice'}</h2><p>{job.serviceNumber} · Completed {date(job.completedAt)}</p></div><span className={`finance-invoice-state ${(job.invoice?.paymentStatus || 'Draft').toLowerCase().replaceAll(' ', '-')}`}>{job.invoice?.paymentStatus || 'Draft'}</span></div>
        <div className="finance-invoice-parties"><div><small>BILL TO</small><strong>{job.customer?.name || 'Customer details unavailable'}</strong><span>{job.customer?.email || ''}</span><span>{job.customer?.mobile || ''}</span></div><div><small>VEHICLE</small><strong>{[job.vehicle?.year, job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(' ') || 'Vehicle details unavailable'}</strong><span>{job.vehicle?.registrationNumber || 'Registration unavailable'}</span><span>{job.serviceType} · Job {job.serviceNumber}</span></div></div>
        <div className="finance-invoice-line-table"><div className="finance-invoice-table-head"><span>Description</span><span>Qty / hours</span><span>Rate</span><span>Amount</span></div>
          {job.parts.map((part, index) => <div className="finance-invoice-line" key={`part-${index}`}><span>{part.name}{part.partNumber ? <small>Part {part.partNumber}</small> : null}</span><span>{part.quantity}</span><span>{money(part.unitPrice)}</span><strong>{money(part.total)}</strong></div>)}
          {job.labourItems.map((item, index) => <div className="finance-invoice-line" key={`labour-${index}`}><span>{item.description}<small>Labour</small></span><span>{item.hours} h</span><span>{money(item.rate)}/h</span><strong>{money(item.total)}</strong></div>)}
          {job.approvedRepairs.map((repair, index) => <div className="finance-invoice-line" key={`repair-${index}`}><span>{repair.description}<small>Approved additional repair</small></span><span>—</span><span>—</span><strong>{money(repair.amount)}</strong></div>)}
          {!job.parts.length && !job.labourItems.length && !job.approvedRepairs.length && <p className="finance-invoice-no-lines">No parts, labour, or approved additional repair charges were recorded.</p>}
        </div>
        <div className="finance-invoice-bottom"><div className="finance-invoice-adjustments"><label>Discount (%)<input type="number" min="0" max="100" step="0.01" value={discountRate} onChange={event => setRateOverrides(current => ({ ...current, [job.id]: { ...current[job.id], discountRate: event.target.value } }))} disabled={busy || job.invoice?.paymentStatus !== 'Draft' && Boolean(job.invoice)} /></label><label>Tax (%)<input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={event => setRateOverrides(current => ({ ...current, [job.id]: { ...current[job.id], taxRate: event.target.value } }))} disabled={busy || job.invoice?.paymentStatus !== 'Draft' && Boolean(job.invoice)} /></label></div><dl className="finance-invoice-totals"><div><dt>Parts</dt><dd>{money(job.partsCost)}</dd></div><div><dt>Labour</dt><dd>{money(job.labourCost)}</dd></div><div><dt>Approved additional repairs</dt><dd>{money(job.additionalRepairsCost)}</dd></div><div><dt>Subtotal</dt><dd>{money(job.subtotal)}</dd></div><div><dt>Discount ({Number(discountRate) || 0}%)</dt><dd>−{money(totals.discount)}</dd></div><div><dt>Tax ({Number(taxRate) || 0}%)</dt><dd>{money(totals.tax)}</dd></div><div className="grand-total"><dt>Total</dt><dd>{money(totals.total)}</dd></div></dl></div>
        <footer className="finance-invoice-actions"><span>All amounts are in LKR.</span><button type="button" className="secondary" onClick={() => saveInvoice(false)} disabled={busy || Boolean(job.invoice && job.invoice.paymentStatus !== 'Draft')}>{busy ? 'Saving…' : 'Save draft'}</button><button type="button" onClick={() => saveInvoice(true)} disabled={busy || Boolean(job.invoice && job.invoice.paymentStatus !== 'Draft')}>{busy ? 'Saving…' : 'Finalize and issue'}</button></footer>
      </section>}
    </div>}
  </main>;
}
