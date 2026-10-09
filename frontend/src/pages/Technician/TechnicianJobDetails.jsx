import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { serviceStatus } from '../../lib/serviceStatus';
import './SimpleService.css';

const money = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'LKR' }).format(value || 0);

export default function TechnicianJobDetails() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.get(`/auth/technician/jobs/${jobId}`, { signal: controller.signal })
      .then(({ data }) => { setJob(data.job); setError(''); })
      .catch(error => { if (!controller.signal.aborted) setError(error.response?.data?.message || 'Unable to load service.'); });
    return () => controller.abort();
  }, [jobId, retry]);

  async function update(action, payload) {
    if (busy) return false;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await api.patch(`/auth/technician/jobs/${jobId}/card`, { action, ...payload });
      setNotice(data.message);
      // Apply completion immediately so a failed refresh cannot leave the editor open.
      if (data.status) setJob(current => ({ ...current, status: data.status }));
      try { const { data: fresh } = await api.get(`/auth/technician/jobs/${jobId}`); setJob(fresh.job); }
      catch { setError('Saved successfully. Refresh to load the latest details.'); }
      return true;
    } catch (error) { setError(error.response?.data?.message || 'Unable to save service.'); return false; }
    finally { setBusy(false); }
  }
  async function submit(event, action) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await update(action, Object.fromEntries(new FormData(form)))) form.reset();
  }
  const completed = job?.status === 'Ready';
  return <main className="simple-service technician-jobs-page">
    <Link to="/technician/jobs">← My Jobs</Link>
    {error && <p role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Refresh</button></p>}
    {notice && <p className="service-notice" role="status">{notice}</p>}
    {!job ? <p role="status">Loading service…</p> : <>
      <header><h1>{job.serviceNumber}</h1><p>{job.vehicle?.make} {job.vehicle?.model} · {job.vehicle?.registrationNumber}</p><strong>{serviceStatus(job.status)}</strong></header>
      <section className="section-card"><h2>Service details</h2><p>{job.serviceType} · {job.customer?.name}</p><p>{job.complaint || job.appointment?.problemDescription}</p><p>Record the parts, labour, and service notes, then complete the service for billing.</p></section>
      <section className="section-card"><h2>Parts</h2>
        {job.replacedParts?.length ? <ul>{job.replacedParts.map(part => <li key={part.id}>{part.name} · {part.quantity} × {money(part.unitCost)} = {money(part.totalCost)} {!completed && <button disabled={busy} onClick={() => update('partRemove', { partId: part.id })}>Remove</button>}</li>)}</ul> : <p>No parts recorded.</p>}
        {!completed && <form onSubmit={event => submit(event, 'partAdd')}><fieldset disabled={busy}><label>Part name<input name="name" required maxLength={200} /></label><label>Quantity<input name="quantity" type="number" min="1" max="10000" defaultValue="1" required /></label><label>Unit price (LKR)<input name="unitCost" type="number" min="0" max="100000000" step="0.01" required /></label><button>Add part</button></fieldset></form>}
        <strong>Parts total: {money(job.partsCost)}</strong>
      </section>
      <section className="section-card"><h2>Labour</h2>
        {job.labourEntries?.length ? <ul>{job.labourEntries.map(entry => <li key={entry.id}>{entry.description} · {entry.minutes} minutes · {money(entry.charge)}</li>)}</ul> : <p>No labour recorded.</p>}
        {!completed && <form onSubmit={event => submit(event, 'labourAdd')}><fieldset disabled={busy}><label>Work description<input name="description" required maxLength={200} /></label><label>Hours<input name="hours" type="number" min="0.01" max="24" step="0.01" required /></label><label>Hourly rate (LKR)<input name="ratePerHour" type="number" min="0" max="100000000" step="0.01" required /></label><button>Add labour</button></fieldset></form>}
        <strong>Labour total: {money(job.labourCost)}</strong>
        {!completed && job.activeLabourTimer && <button disabled={busy} onClick={() => update('labourTimerStop')}>Stop existing labour timer</button>}
      </section>
      <section className="section-card"><h2>Service notes</h2><ul>{job.repairNotes?.map(note => <li key={note.id}>{note.note}</li>)}</ul>
        {!completed && <form onSubmit={event => submit(event, 'repairNote')}><fieldset disabled={busy}><label>Note<textarea name="note" required maxLength={2000} /></label><button>Add note</button></fieldset></form>}
      </section>
      {!completed && job.tasks?.some(task => !['Complete', 'Cancelled'].includes(task.status)) && <section className="section-card"><h2>Existing tasks</h2><p>Finish or cancel tasks already recorded for this service.</p>{job.tasks.filter(task => !['Complete', 'Cancelled'].includes(task.status)).map(task => <p key={task.id}>{task.title} <button disabled={busy} onClick={() => update('taskUpdate', { taskId: task.id, status: 'Complete' })}>Complete task</button> <button disabled={busy} onClick={() => update('taskUpdate', { taskId: task.id, status: 'Cancelled' })}>Cancel task</button></p>)}</section>}
      {!completed && job.additionalRepairs?.some(repair => repair.status === 'Pending') && <section className="section-card"><p>This existing service has an outstanding customer approval. Ask the customer to resolve it from their earlier notification before completing the service.</p></section>}
      <section className="section-card"><h2>{completed ? 'Service completed' : 'Complete service'}</h2>
        {completed ? <><p>{job.finalReport?.notes}</p><p>The invoice is available for Admin to review and issue.</p></> : <form onSubmit={event => submit(event, 'completeJob')}><fieldset disabled={busy}><label>Completion notes<textarea name="reportNotes" required maxLength={3000} placeholder="Describe the work completed" /></label><p>Completing the service sends the recorded charges to Admin. Payment is verified separately.</p><button disabled={busy || job.status === 'Waiting for Approval'}>{busy ? 'Saving…' : 'Complete service'}</button></fieldset></form>}
      </section>
    </>}
  </main>;
}
