import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import './CustomerRepairApprovals.css';

const money = value => value == null || !Number.isFinite(Number(value)) ? 'Not provided' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'LKR', maximumFractionDigits: 2 }).format(Number(value));
const dateTime = value => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
const totalCost = item => item.estimatedCost ?? (item.parts?.length || item.labourCost != null ? (item.parts || []).reduce((sum, part) => sum + (Number(part.totalCost) || (Number(part.unitCost) || 0) * (Number(part.quantity) || 0)), 0) + (Number(item.labourCost) || 0) : null);

function ApprovalCard({ item, onDecide, busy }) {
  const [comment, setComment] = useState(item.customerComment || '');
  return <article className="approval-card">
    <header className="approval-card-header"><div><p className="approval-eyebrow">{item.serviceNumber} · {item.vehicle}</p><h2>{item.problem || 'Additional repair requested'}</h2></div><span className={`approval-status status-${item.status.toLowerCase()}`}>{item.status}</span></header>
    <p className="approval-explanation">{item.technicianExplanation || 'The workshop has not added an explanation.'}</p>
    {item.photos.length > 0 && <section className="approval-photos" aria-label="Repair photos"><h3>Inspection photos</h3><div>{item.photos.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={`${url}-${index}`} aria-label={`Open repair photo ${index + 1}`}><img src={url} alt={`Repair finding ${index + 1}`} loading="lazy" /></a>)}</div></section>}
    <section className="approval-costs"><h3>Estimated costs</h3>
      {item.parts.length > 0 && <div className="approval-parts">{item.parts.map((part, index) => <div className="approval-cost-row" key={`${part.name}-${index}`}><span>{part.name}{part.quantity != null ? ` × ${part.quantity}` : ''}</span><span>{money(part.totalCost ?? (part.unitCost != null && part.quantity != null ? part.unitCost * part.quantity : null))}</span></div>)}</div>}
      <div className="approval-cost-row"><span>Parts total</span><span>{item.parts.length ? money(item.parts.reduce((sum, part) => sum + (Number(part.totalCost) || (Number(part.unitCost) || 0) * (Number(part.quantity) || 0)), 0)) : 'Not itemized'}</span></div>
      <div className="approval-cost-row"><span>Labour</span><span>{money(item.labourCost)}</span></div>
      <div className="approval-cost-row total"><strong>Total additional cost</strong><strong>{money(totalCost(item))}</strong></div>
    </section>
    {item.status === 'Pending' ? <div className="approval-decision"><label htmlFor={`comment-${item.id}`}>Comment for the workshop <span>Optional</span></label><textarea id={`comment-${item.id}`} value={comment} onChange={event => setComment(event.target.value)} maxLength={1000} rows={3} placeholder="Add a question or note…" />
      <div className="approval-requested"><span>Requested {dateTime(item.requestedAt)}</span><span>{comment.length}/1000</span></div>
      <div className="approval-actions"><button className="approval-reject" type="button" disabled={busy} onClick={() => onDecide(item, 'Rejected', comment)}>{busy ? 'Saving…' : 'Decline repair'}</button><button className="approval-accept" type="button" disabled={busy} onClick={() => onDecide(item, 'Approved', comment)}>{busy ? 'Saving…' : 'Approve repair'}</button></div>
    </div> : <div className="approval-decision-summary"><span>{item.status} · {dateTime(item.decisionAt)}</span>{item.customerComment && <p>“{item.customerComment}”</p>}</div>}
  </article>;
}

export default function CustomerRepairApprovals() {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/repair-approvals', { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) { setRequests(data); setError(''); } })
      .catch(err => { if (!controller.signal.aborted) setError(err.response?.data?.message || 'Unable to load repair approval requests.'); });
    return () => controller.abort();
  }, [retry]);

  const decide = async (item, decision, comment) => {
    setBusyId(item.id); setError(''); setNotice('');
    try {
      const { data } = await api.patch(`/repair-approvals/${item.jobId}/repairs/${item.id}/decision`, { decision, comment });
      setRequests(current => current?.map(request => request.id === item.id ? { ...request, ...data } : request));
      setNotice(data.notified ? `Repair ${decision.toLowerCase()}. The workshop has been notified.` : `Repair ${decision.toLowerCase()} and saved. The workshop notification could not be delivered.`);
    } catch (err) { setError(err.response?.data?.message || 'Unable to save your decision. Please try again.'); }
    finally { setBusyId(''); }
  };
  const pending = requests?.filter(item => item.status === 'Pending') || [];
  const decided = requests?.filter(item => item.status !== 'Pending') || [];

  return <main className="customer-approvals-page">
    <div className="approval-page-heading"><div><p className="approval-eyebrow">SERVICE WORKSHOP</p><h1>Additional Repair Approval</h1><p>Review the workshop’s findings and estimated cost before deciding.</p></div><Link to="/customer/repair-tracking">Repair tracking</Link></div>
    {error && <div className="approval-error" role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
    {notice && <div className="approval-success" role="status">{notice}</div>}
    {requests === null && !error && <div className="approval-loading" role="status">Loading approval requests…</div>}
    {requests?.length === 0 && <section className="approval-empty"><h2>No additional repair requests</h2><p>Any work that needs your approval will appear here with its estimate and findings.</p><Link to="/customer/repair-tracking">Return to repair tracking</Link></section>}
    {pending.length > 0 && <section aria-labelledby="pending-approvals"><div className="approval-section-title"><h2 id="pending-approvals">Awaiting your decision</h2><span>{pending.length}</span></div>{pending.map(item => <ApprovalCard key={item.id} item={item} onDecide={decide} busy={busyId === item.id} />)}</section>}
    {decided.length > 0 && <section aria-labelledby="decided-approvals"><div className="approval-section-title"><h2 id="decided-approvals">Decision history</h2></div>{decided.map(item => <ApprovalCard key={item.id} item={item} onDecide={decide} busy={busyId === item.id} />)}</section>}
  </main>;
}
