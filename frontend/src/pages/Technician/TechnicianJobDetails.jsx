// Record parts and labour on an assigned service job and submit completion; the server response controls whether editing remains available.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { serviceStatus } from '../../lib/serviceStatus';
import './SimpleService.css';

const timestamp = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded';

export default function TechnicianJobDetails() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  // Load server data when these effect dependencies change; cleanup below prevents stale work from updating this view.
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
      // Request a server-side change; update the displayed state from the successful response below.
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
    const values = Object.fromEntries(new FormData(form));
    if (action === 'completeJob') values.workDone = String(values.workDone || '').split('\n').map(item => item.trim()).filter(Boolean);
    if (await update(action, values)) form.reset();
  }

  const completed = job?.status === 'Ready';

  return <main className="simple-service technician-jobs-page">
    <Link to="/technician/jobs" className="technician-back-link">← My Jobs</Link>
    {error && <p className="technician-jobs-error" role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Refresh</button></p>}
    {notice && <p className="service-notice" role="status">{notice}</p>}
    {!job ? <p role="status">Loading service…</p> : <>
      <header className="service-header">
        <h1>{job.serviceNumber}</h1>
        <p className="vehicle-subtitle">{job.vehicle?.make} {job.vehicle?.model} · {job.vehicle?.registrationNumber}</p>
        <span className="status-badge">{serviceStatus(job.status)}</span>
      </header>

      <section className="section-card">
        <h2>Service details</h2>
        <p><strong>Type:</strong> {job.serviceType} · <strong>Customer:</strong> {job.customer?.name} ({job.customer?.mobile || 'No phone'})</p>
        <p><strong>Issue type:</strong> {job.issueType || 'Other'}</p>
        <p><strong>Started:</strong> {timestamp(job.startedAt)} · <strong>Completed:</strong> {timestamp(job.completedAt)}</p>
        {job.expectedCompletionTime && <p><strong>Estimated finish:</strong> {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(job.expectedCompletionTime))}</p>}
        {job.complaint && <p><strong>Customer note:</strong> {job.complaint}</p>}
        {job.appointment?.problemDescription && job.appointment?.problemDescription !== job.complaint && (
          <p><strong>Problem description:</strong> {job.appointment.problemDescription}</p>
        )}
        <p className="section-help-text">Record parts used, work time and service notes. Admin adds all prices after you complete the job.</p>
      </section>

      {!job.technicianAcceptedAt ? (
        <section className="section-card completion-card">
          <h2>Accept assigned job</h2>
          <p>Confirm that you are taking responsibility for this assigned service job. You can then update its progress and record the work performed.</p>
          <button type="button" className="btn-complete" disabled={busy} onClick={() => update('acceptJob')}>
            {busy ? 'Accepting…' : 'Accept job'}
          </button>
        </section>
      ) : <>

      <section className="section-card">
        <h2>Parts / Replaced Items</h2>
        {job.replacedParts?.length ? (
          <ul className="charges-list">
            {job.replacedParts.map(part => (
              <li key={part.id} className="charge-item">
                <span><strong>{part.name}</strong> {part.partNumber ? `(${part.partNumber})` : ''} · Quantity: {part.quantity}</span>
                {!completed && <button type="button" className="btn-remove" disabled={busy} onClick={() => update('partRemove', { partId: part.id })}>Remove</button>}
              </li>
            ))}
          </ul>
        ) : <p className="muted-text">No parts recorded (parts are optional if only servicing).</p>}
        {!completed && (
          <form onSubmit={event => submit(event, 'partAdd')} className="charge-form">
            <fieldset disabled={busy}>
              <label>Part name<input name="name" placeholder="e.g. Engine Oil 4L, Oil Filter" required maxLength={200} /></label>
              <label>Part # / Code (optional)<input name="partNumber" placeholder="e.g. FL-910S" maxLength={100} /></label>
              <label>Quantity<input name="quantity" type="number" min="1" max="10000" defaultValue="1" required /></label>
              <button type="submit" className="btn-add">Add part</button>
            </fieldset>
          </form>
        )}
      </section>

      <section className="section-card">
        <h2>Work time</h2>
        <p>The job start and completion times are recorded automatically. Admin uses them for hourly pricing.</p>
        {job.labourEntries?.length > 0 && <ul>{job.labourEntries.map(entry => <li key={entry.id}>{entry.description} · {entry.minutes} minutes{' '}{!completed && <button type="button" className="btn-remove" disabled={busy} onClick={() => update('labourRemove', { labourId: entry.id })}>Remove</button>}</li>)}</ul>}
        {!completed && <form onSubmit={event => submit(event, 'labourAdd')} className="charge-form">
          <fieldset disabled={busy}>
            <label>Work description<input name="description" required maxLength={200} /></label>
            <label>Hours worked<input name="hours" type="number" min="0.01" max="24" step="0.01" required /></label>
            <button type="submit" className="btn-add">Record work time</button>
          </fieldset>
        </form>}
        {!completed && job.activeLabourTimer && <button className="btn-secondary" disabled={busy} onClick={() => update('labourTimerStop')}>Stop existing labour timer</button>}
      </section>

      <section className="section-card">
        <h2>Service notes</h2>
        {job.repairNotes?.length ? (
          <ul>{job.repairNotes.map(note => <li key={note.id}>{note.note}</li>)}</ul>
        ) : <p className="muted-text">No service notes added.</p>}
        {!completed && (
          <form onSubmit={event => submit(event, 'repairNote')}>
            <fieldset disabled={busy}>
              <label>Note<textarea name="note" required maxLength={2000} placeholder="Add technician observations or work notes..." /></label>
              <button type="submit" className="btn-add">Add note</button>
            </fieldset>
          </form>
        )}
      </section>

      {!completed && job.tasks?.some(task => !['Complete', 'Cancelled'].includes(task.status)) && (
        <section className="section-card">
          <h2>Existing tasks</h2>
          <p>Finish or cancel tasks already recorded for this service.</p>
          {job.tasks.filter(task => !['Complete', 'Cancelled'].includes(task.status)).map(task => (
            <p key={task.id}>
              {task.title}{' '}
              <button disabled={busy} onClick={() => update('taskUpdate', { taskId: task.id, status: 'Complete' })}>Complete task</button>{' '}
              <button disabled={busy} onClick={() => update('taskUpdate', { taskId: task.id, status: 'Cancelled' })}>Cancel task</button>
            </p>
          ))}
        </section>
      )}

      <section className="section-card completion-card">
        <h2>{completed ? 'Service completed' : 'Complete service'}</h2>
        {completed ? (
          <>
            <p className="completed-badge">✓ Job marked Ready and sent to billing.</p>
            {(job.finalReport?.workDone?.length ? job.finalReport.workDone : job.finalReport?.notes ? [job.finalReport.notes] : []).length > 0 && (
              <div><strong>Work completed</strong><ul>{(job.finalReport?.workDone?.length ? job.finalReport.workDone : [job.finalReport.notes]).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>
            )}
            {job.billingInvoice && (
              <p><strong>Draft invoice:</strong> {job.billingInvoice.invoiceNumber}</p>
            )}
            <p>Admin will enter spare-part prices, hourly rates and service charges before issuing the invoice.</p>
          </>
        ) : (
          <form onSubmit={event => submit(event, 'completeJob')}>
            <fieldset disabled={busy} style={{ display: 'grid', gap: '0.8rem' }}>
              <label>
                Work completed (one item per line)
                <textarea name="workDone" required maxLength={3000} placeholder={'Oil and filter replaced\nFront brakes inspected and adjusted\nRoad test completed'} />
              </label>
              <p className="section-help-text">Completing the service saves the completion time and sends a draft invoice to Admin for pricing. Customer payment is verified separately.</p>
              <button type="submit" className="btn-complete" disabled={busy || job.status === 'Waiting for Approval'}>
                {busy ? 'Saving…' : 'Complete Service'}
              </button>
            </fieldset>
          </form>
        )}
      </section>
      </>}
    </>}
  </main>;
}

