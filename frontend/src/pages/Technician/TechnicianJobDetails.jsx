import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import '../Customer/CustomerDashboard.css';
import './TechnicianJobs.css';
import './TechnicianJobCard.css';

const dateTime = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not scheduled';
const imageUrl = (jobId, photoId) => `${api.defaults.baseURL}/auth/technician/jobs/${jobId}/photos/${photoId}`;
const lines = value => value.split('\n').map(item => item.trim()).filter(Boolean);

async function preparePhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  for (const quality of [0.7, 0.58, 0.45]) {
    if (blob?.size <= 1.4 * 1024 * 1024) break;
    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  if (!blob || blob.size > 1.4 * 1024 * 1024) throw new Error('This image is too large to upload. Choose a smaller photo.');
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read this image.'));
    reader.readAsDataURL(blob);
  });
  const filename = `${file.name.replace(/\.[^.]+$/, '').slice(0, 140) || 'job-photo'}.jpg`;
  return { filename, contentType: 'image/jpeg', data };
}

export default function TechnicianJobDetails() {
  const { jobId } = useParams();
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [labourHours, setLabourHours] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);

  const loadJob = useCallback(async signal => {
    const { data } = await api.get(`/auth/technician/jobs/${jobId}`, { signal });
    return data.job;
  }, [jobId]);

  useEffect(() => {
    const controller = new AbortController();
    loadJob(controller.signal).then(job => {
      if (!controller.signal.aborted) {
        // oxlint-disable-next-line react(set-state-in-effect) -- Store the response from an async data fetch.
        setResult({ jobId, job });
      }
    }).catch(requestError => {
      if (!controller.signal.aborted) {
        // oxlint-disable-next-line react(set-state-in-effect) -- Store the result of the failed async API request.
        setResult({ jobId, error: requestError.response?.data?.message || 'Unable to load this service job.' });
      }
    });
    return () => controller.abort();
  }, [jobId, retry, loadJob]);

  async function updateCard(action, payload = {}) {
    if (busy) return false;
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await api.patch(`/auth/technician/jobs/${jobId}/card`, { action, ...payload });
      setNotice(data.message);
      setResult({ jobId, job: await loadJob() });
      return true;
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save this job card update.'); return false; }
    finally { setBusy(false); }
  }

  async function submitForm(event, action, buildPayload) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (await updateCard(action, buildPayload(form))) formElement.reset();
  }

  async function uploadPhoto(event, category = 'Job') {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true); setError(''); setNotice('');
    try {
      const photo = await preparePhoto(file);
      const { data } = await api.post(`/auth/technician/jobs/${jobId}/photos`, { ...photo, category }, { timeout: 30000 });
      setNotice(`${data.photo.filename} uploaded.`);
      setResult({ jobId, job: await loadJob() });
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Unable to upload this photo.'); }
    finally { setPhotoBusy(false); event.target.value = ''; }
  }

  const current = result?.jobId === jobId ? result : null;
  if (!current) return <main className="technician-jobs-page" role="status">Loading service job…</main>;
  if (current.error) return <main className="technician-jobs-page"><p role="alert">{current.error}</p><button className="btn-primary" type="button" onClick={() => setRetry(value => value + 1)}>Try again</button><Link className="technician-back-link" to="/technician/jobs">Back to My Jobs</Link></main>;
  const { job } = current;
  const vehicleLabel = job.vehicle ? `${job.vehicle.year ? `${job.vehicle.year} ` : ''}${job.vehicle.make} ${job.vehicle.model}${job.vehicle.registrationNumber ? ` · ${job.vehicle.registrationNumber}` : ''}` : 'Vehicle details unavailable';
  const nextStatus = { Inspecting: 'In Progress', 'In Progress': 'Final Test', 'Final Test': 'Ready' }[job.status];
  const pendingApproval = job.additionalRepairs?.some(repair => repair.status === 'Pending');

  return <main className="technician-jobs-page technician-job-card-page">
    <Link className="technician-back-link" to="/technician/jobs">← Back to My Jobs</Link>
    <header className="technician-jobs-heading technician-job-detail-heading"><div><p className="technician-jobs-eyebrow">DIGITAL JOB CARD</p><h1 className="page-title">{job.serviceNumber}</h1><p className="page-subtitle">{vehicleLabel}</p></div><span className="badge badge-warning">{job.status}</span></header>
    {error && <div className="technician-card-message error" role="alert">{error}</div>}{notice && <div className="technician-card-message success" role="status">{notice}</div>}
    <section className="section-card technician-job-detail-card"><h2>Job overview</h2><dl className="technician-job-detail-grid">
      <div><dt>Priority</dt><dd><span className={`technician-priority ${job.priority.toLowerCase()}`}>{job.priority}</span></dd></div>
      <div><dt>Service type</dt><dd>{job.serviceType}</dd></div>
      <div><dt>Expected completion</dt><dd>{dateTime(job.expectedCompletionTime)}</dd></div>
      <div><dt>Customer</dt><dd>{job.customer.name}{job.customer.mobile ? ` · ${job.customer.mobile}` : ''}</dd></div>
      <div><dt>Vehicle</dt><dd>{vehicleLabel}</dd></div>
      <div><dt>Assigned technician</dt><dd>{job.assignedTechnician}</dd></div>
      <div><dt>Appointment</dt><dd>{job.appointment ? `${dateTime(job.appointment.preferredDate)}${job.appointment.preferredTime ? ` · ${job.appointment.preferredTime}` : ''}` : 'No appointment linked'}</dd></div>
      <div><dt>Appointment status</dt><dd>{job.appointment?.status || 'Not available'}</dd></div>
    </dl>
    {job.complaint && <div className="technician-job-detail-section"><h3>Customer complaint</h3><p>{job.complaint}</p></div>}
    {job.appointment?.problemDescription && <div className="technician-job-detail-section"><h3>Appointment notes</h3><p>{job.appointment.problemDescription}</p></div>}
    </section>

    <section className="section-card technician-card-section"><header><div><h2>Inspection and diagnosis</h2><p>Record findings, diagnosis, issues, and repair recommendations.</p></div>{job.inspection?.completedAt && <span className="technician-card-complete">Inspection completed</span>}</header>
      {!job.inspection?.startedAt && <button className="technician-inspection-start" type="button" disabled={busy || job.status !== 'Inspecting'} onClick={() => updateCard('inspectionStart')}>{busy ? 'Starting…' : 'Start inspection'}</button>}
      {job.inspection?.startedAt && <p className="technician-inspection-time">Started {dateTime(job.inspection.startedAt)}{job.inspection.completedAt ? ` · Completed ${dateTime(job.inspection.completedAt)}` : ''}</p>}
      <form onSubmit={event => submitForm(event, 'inspection', form => ({
        findings: form.get('findings'), diagnosis: form.get('diagnosis'), notes: form.get('notes'),
        issues: lines(form.get('issues')), recommendedRepairs: lines(form.get('recommendedRepairs')),
      }))}>
        <fieldset disabled={!job.inspection?.startedAt || Boolean(job.inspection?.completedAt) || busy}>
        <label>Inspection findings<textarea name="findings" maxLength={5000} defaultValue={job.inspection?.findings || ''} rows={3} /></label>
        <label>Diagnosis<textarea name="diagnosis" maxLength={5000} defaultValue={job.inspection?.diagnosis || ''} rows={3} /></label>
        <label>Issues found<textarea name="issues" maxLength={3000} defaultValue={(job.inspection?.issues || []).join('\n')} placeholder="One issue per line" rows={3} /></label>
        <label>Recommended repairs<textarea name="recommendedRepairs" maxLength={3000} defaultValue={(job.inspection?.recommendedRepairs || []).join('\n')} placeholder="One recommendation per line" rows={3} /></label>
        <label>Inspection notes<textarea name="notes" maxLength={5000} defaultValue={job.inspection?.notes || ''} rows={3} /></label>
        <button type="submit">Save inspection</button>
        {!job.inspection?.completedAt && job.inspection?.startedAt && <button type="button" onClick={event => { const form = new FormData(event.currentTarget.form); updateCard('inspection', { findings: form.get('findings'), diagnosis: form.get('diagnosis'), notes: form.get('notes'), issues: lines(form.get('issues')), recommendedRepairs: lines(form.get('recommendedRepairs')), complete: true }); }}>Mark inspection complete</button>}
        </fieldset>
      </form>
      <div className="technician-inspection-images"><div><h3>Inspection images</h3><p>Attach photos taken during this vehicle inspection.</p></div><label className="technician-photo-picker">{photoBusy ? 'Uploading photo…' : 'Add inspection image'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!job.inspection?.startedAt || Boolean(job.inspection?.completedAt) || photoBusy || (job.photos?.length || 0) >= 12} onChange={event => uploadPhoto(event, 'Inspection')} /></label></div>
      {job.photos?.some(photo => photo.category === 'Inspection') ? <div className="technician-photo-grid">{job.photos.filter(photo => photo.category === 'Inspection').map(photo => <figure key={photo.id}><img src={imageUrl(job.id, photo.id)} alt={photo.filename} loading="lazy" /><figcaption>{photo.filename}<small>{dateTime(photo.createdAt)}</small></figcaption></figure>)}</div> : <p className="technician-card-empty">No inspection images attached.</p>}
    </section>

    <section className="section-card technician-card-section"><header><div><h2>Repair notes</h2><p>Notes are saved with your technician account and timestamp.</p></div></header>
      <form className="technician-card-inline-form" onSubmit={event => submitForm(event, 'repairNote', form => ({ note: form.get('note') }))}><label>Add a repair note<textarea name="note" required maxLength={2000} rows={3} /></label><button type="submit" disabled={busy}>Add note</button></form>
      {job.repairNotes?.length > 0 && <ul className="technician-card-note-list">{[...job.repairNotes].reverse().map(note => <li key={note.id}><p>{note.note}</p><small>{dateTime(note.createdAt)}</small></li>)}</ul>}
    </section>

    <section className="section-card technician-card-section"><header><div><h2>Repair tasks</h2><p>Track the work required to complete this job.</p></div><span>{job.tasks?.filter(task => task.status === 'Complete').length || 0} / {job.tasks?.length || 0} complete</span></header>
      <form className="technician-card-inline-form" onSubmit={event => submitForm(event, 'taskAdd', form => ({ title: form.get('title'), notes: form.get('notes') }))}><label>New task<input name="title" required maxLength={200} /></label><label>Notes<input name="notes" maxLength={1000} /></label><button type="submit" disabled={busy}>Add task</button></form>
      {job.tasks?.length ? <div className="technician-card-task-list">{job.tasks.map(task => <article key={task.id}><div><strong>{task.title}</strong>{task.notes && <p>{task.notes}</p>}{task.completedAt && <small>Completed {dateTime(task.completedAt)}</small>}</div><label className="sr-only" htmlFor={`task-${task.id}`}>Status for {task.title}</label><select id={`task-${task.id}`} value={task.status} disabled={busy} onChange={event => updateCard('taskUpdate', { taskId: task.id, status: event.target.value })}><option>Pending</option><option>In Progress</option><option>Complete</option></select></article>)}</div> : <p className="technician-card-empty">No repair tasks added yet.</p>}
    </section>

    <section className="section-card technician-card-section"><header><div><h2>Parts used</h2><p>Record each replaced part and its quantity and unit price.</p></div></header>
      <form className="technician-card-inline-form parts-form" onSubmit={event => submitForm(event, 'partAdd', form => ({ name: form.get('name'), partNumber: form.get('partNumber'), quantity: form.get('quantity'), unitCost: form.get('unitCost') }))}><label>Part name<input name="name" required maxLength={200} /></label><label>Part number<input name="partNumber" maxLength={100} /></label><label>Quantity<input name="quantity" type="number" min="0.01" step="any" required /></label><label>Unit price<input name="unitCost" type="number" min="0" step="0.01" required /></label><button type="submit" disabled={busy}>Add part</button></form>
      {job.replacedParts?.length ? <div className="technician-card-table-wrap"><table><thead><tr><th>Part</th><th>Number</th><th>Qty</th><th>Unit price</th><th>Recorded</th></tr></thead><tbody>{job.replacedParts.map(part => <tr key={part.id}><td>{part.name}</td><td>{part.partNumber || '—'}</td><td>{part.quantity}</td><td>{Number(part.unitCost || 0).toFixed(2)}</td><td>{dateTime(part.replacedAt)}</td></tr>)}</tbody></table></div> : <p className="technician-card-empty">No parts recorded yet.</p>}
    </section>

    <section className="section-card technician-card-section"><header><div><h2>Labour time</h2><p>Record the hours spent on this service job.</p></div><strong>{((job.labourEntries || []).reduce((sum, entry) => sum + entry.minutes, 0) / 60).toFixed(2)} hours total</strong></header>
      <form className="technician-card-inline-form" onSubmit={async event => { event.preventDefault(); const description = event.currentTarget.description.value; if (await updateCard('labourAdd', { description, hours: labourHours })) setLabourHours(''); }}><label>Work description<input name="description" maxLength={200} placeholder="Repair labour" /></label><label>Hours<input type="number" min="0.01" max="24" step="0.01" required value={labourHours} onChange={event => setLabourHours(event.target.value)} /></label><button type="submit" disabled={busy}>Record time</button></form>
      {job.labourEntries?.length > 0 && <ul className="technician-card-note-list">{[...job.labourEntries].reverse().map(entry => <li key={entry.id}><p><strong>{entry.description}</strong> · {(entry.minutes / 60).toFixed(2)} hours</p><small>{dateTime(entry.recordedAt)}</small></li>)}</ul>}
    </section>

    <section className="section-card technician-card-section"><header><div><h2>Job photos</h2><p>Upload JPEG, PNG, or WebP photos. Images are resized and limited to 1.4 MB.</p></div><span>{job.photos?.length || 0} / 12 total</span></header>
      <label className="technician-photo-picker">{photoBusy ? 'Uploading photo…' : 'Choose a job photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy || (job.photos?.length || 0) >= 12} onChange={uploadPhoto} /></label>
      {job.photos?.some(photo => photo.category !== 'Inspection') ? <div className="technician-photo-grid">{job.photos.filter(photo => photo.category !== 'Inspection').map(photo => <figure key={photo.id}><img src={imageUrl(job.id, photo.id)} alt={photo.filename} loading="lazy" /><figcaption>{photo.filename}<small>{dateTime(photo.createdAt)}</small></figcaption></figure>)}</div> : <p className="technician-card-empty">No job photos attached.</p>}
    </section>

    <section className="section-card technician-card-section"><header><div><h2>Customer approval</h2><p>Request approval before performing additional repair work.</p></div></header>
      {job.additionalRepairs?.length > 0 && <ul className="technician-card-note-list">{[...job.additionalRepairs].reverse().map(repair => <li key={repair.id}><p><strong>{repair.description}</strong> · {repair.status}{repair.estimatedCost != null ? ` · Estimated ${Number(repair.estimatedCost).toFixed(2)}` : ''}</p><small>{dateTime(repair.requestedAt)}</small></li>)}</ul>}
      <form className="technician-card-approval-form" onSubmit={event => submitForm(event, 'approvalRequest', form => ({ description: form.get('description'), explanation: form.get('explanation'), estimatedCost: form.get('estimatedCost'), labourCost: form.get('labourCost') }))}>
        <label>Additional repair<input name="description" required maxLength={2000} /></label><label>Reason for repair<textarea name="explanation" maxLength={3000} rows={3} /></label><label>Estimated parts and repair cost<input name="estimatedCost" type="number" min="0" step="0.01" required /></label><label>Labour estimate<input name="labourCost" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <button type="submit" disabled={busy || pendingApproval || !['Inspecting', 'In Progress'].includes(job.status)}>{pendingApproval ? 'Approval pending' : 'Request customer approval'}</button>
      </form>
    </section>

    <section className="section-card technician-card-section"><header><div><h2>Update job status</h2><p>Job status changes are added to the service history.</p></div></header>
      {nextStatus ? <button type="button" disabled={busy || (nextStatus === 'Final Test' && job.tasks?.some(task => task.status !== 'Complete'))} onClick={() => updateCard('status', { status: nextStatus })}>{busy ? 'Saving…' : `Move to ${nextStatus}`}</button> : <p className="technician-card-empty">{job.status === 'Waiting for Approval' ? 'This job will return to repair when the customer responds.' : 'This job is at its final workflow stage.'}</p>}
      {nextStatus === 'Final Test' && job.tasks?.some(task => task.status !== 'Complete') && <p className="technician-card-hint">Complete all repair tasks before final testing.</p>}
    </section>

    {job.timeline?.length > 0 && <section className="section-card technician-card-section"><header><h2>Job history</h2></header><ol className="technician-job-timeline">{[...job.timeline].reverse().slice(0, 10).map((event, index) => <li key={`${event.status}-${index}`}><strong>{event.status}</strong><span>{dateTime(event.timestamp)}</span>{event.notes && <p>{event.notes}</p>}</li>)}</ol></section>}
  </main>;
}
