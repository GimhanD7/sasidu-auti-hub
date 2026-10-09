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
  const [labourInputMode, setLabourInputMode] = useState('direct'); // 'direct' | 'hourly'

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
  const totalJobCost = (job?.partsCost || 0) + (job?.labourCost || 0);

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
        {job.complaint && <p><strong>Customer note:</strong> {job.complaint}</p>}
        {job.appointment?.problemDescription && job.appointment?.problemDescription !== job.complaint && (
          <p><strong>Problem description:</strong> {job.appointment.problemDescription}</p>
        )}
        <p className="section-help-text">Record parts replaced (optional), direct service charges or labour, and complete the service when finished.</p>
      </section>

      <section className="section-card">
        <h2>Parts / Replaced Items</h2>
        {job.replacedParts?.length ? (
          <ul className="charges-list">
            {job.replacedParts.map(part => (
              <li key={part.id} className="charge-item">
                <span><strong>{part.name}</strong> {part.partNumber ? `(${part.partNumber})` : ''} · {part.quantity} × {money(part.unitCost)} = {money(part.totalCost)}</span>
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
              <label>Unit price (LKR)<input name="unitCost" type="number" min="0" max="100000000" step="0.01" required /></label>
              <button type="submit" className="btn-add">Add part</button>
            </fieldset>
          </form>
        )}
        <div className="total-row"><strong>Parts Total: {money(job.partsCost)}</strong></div>
      </section>

      <section className="section-card">
        <h2>Labour & Service Charges</h2>
        {job.labourEntries?.length ? (
          <ul className="charges-list">
            {job.labourEntries.map(entry => (
              <li key={entry.id} className="charge-item">
                <span>
                  <strong>{entry.description}</strong>
                  {entry.ratePerHour && entry.minutes > 0 ? ` · ${entry.minutes} mins (@ ${money(entry.ratePerHour)}/hr) ` : ''}
                  — <strong>{money(entry.charge)}</strong>
                </span>
                {!completed && (
                  <button type="button" className="btn-remove" disabled={busy} onClick={() => update('labourRemove', { labourId: entry.id })}>Remove</button>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="muted-text">No service charges or labour recorded yet.</p>}

        {!completed && (
          <div className="labour-input-container">
            <div className="input-mode-tabs">
              <button
                type="button"
                className={`tab-btn ${labourInputMode === 'direct' ? 'active' : ''}`}
                onClick={() => setLabourInputMode('direct')}
              >
                + Direct Service Charge (Fixed Amount)
              </button>
              <button
                type="button"
                className={`tab-btn ${labourInputMode === 'hourly' ? 'active' : ''}`}
                onClick={() => setLabourInputMode('hourly')}
              >
                + Hourly Labour (Hours × Rate)
              </button>
            </div>

            {labourInputMode === 'direct' ? (
              <form onSubmit={event => submit(event, 'labourAdd')} className="charge-form">
                <fieldset disabled={busy}>
                  <label>
                    Service Description
                    <input name="description" placeholder="e.g. Periodic Full Service, Engine Diagnostics, Inspection Fee" required maxLength={200} />
                  </label>
                  <label>
                    Direct Service Amount (LKR)
                    <input name="amount" type="number" min="0" max="100000000" step="0.01" placeholder="e.g. 3500.00" required />
                  </label>
                  <button type="submit" className="btn-add">Add service charge</button>
                </fieldset>
              </form>
            ) : (
              <form onSubmit={event => submit(event, 'labourAdd')} className="charge-form">
                <fieldset disabled={busy}>
                  <label>
                    Work Description
                    <input name="description" placeholder="e.g. Brake system overhaul" required maxLength={200} />
                  </label>
                  <label>
                    Hours
                    <input name="hours" type="number" min="0.01" max="24" step="0.01" placeholder="e.g. 1.5" required />
                  </label>
                  <label>
                    Hourly rate (LKR)
                    <input name="ratePerHour" type="number" min="0" max="100000000" step="0.01" placeholder="e.g. 1500" required />
                  </label>
                  <button type="submit" className="btn-add">Add hourly labour</button>
                </fieldset>
              </form>
            )}
          </div>
        )}

        <div className="total-row"><strong>Labour & Service Charges Total: {money(job.labourCost)}</strong></div>
        {!completed && job.activeLabourTimer && <button className="btn-secondary" disabled={busy} onClick={() => update('labourTimerStop')}>Stop existing labour timer</button>}
      </section>

      <section className="section-card job-cost-summary-card">
        <h2>Cost Summary</h2>
        <div className="summary-breakdown">
          <p><span>Parts Total:</span> <strong>{money(job.partsCost)}</strong></p>
          <p><span>Labour & Service Charges:</span> <strong>{money(job.labourCost)}</strong></p>
          <hr />
          <p className="grand-total"><span>Total Job Charge:</span> <strong>{money(totalJobCost)}</strong></p>
        </div>
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
            {job.finalReport?.notes && <p><strong>Completion Notes:</strong> {job.finalReport.notes}</p>}
            {job.billingInvoice && (
              <p><strong>Invoice Number:</strong> {job.billingInvoice.invoiceNumber} · <strong>Invoice Amount:</strong> {money(job.billingInvoice.totalAmount)}</p>
            )}
            <p>The invoice is available for Admin to review, apply tax/discounts if needed, and issue.</p>
          </>
        ) : (
          <form onSubmit={event => submit(event, 'completeJob')}>
            <fieldset disabled={busy} style={{ display: 'grid', gap: '0.8rem' }}>
              <label>
                Completion notes
                <textarea name="reportNotes" required maxLength={3000} placeholder="Describe the work completed, inspection results, or remarks..." />
              </label>
              <p className="section-help-text">Completing the service generates the billing invoice with total {money(totalJobCost)} and notifies Admin. Customer payment is verified separately.</p>
              <button type="submit" className="btn-complete" disabled={busy || job.status === 'Waiting for Approval'}>
                {busy ? 'Saving…' : `Complete Service (${money(totalJobCost)})`}
              </button>
            </fieldset>
          </form>
        )}
      </section>
    </>}
  </main>;
}

