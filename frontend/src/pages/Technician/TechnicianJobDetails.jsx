import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Not scheduled';
const imageUrl = (jobId, photoId) =>
  `${api.defaults.baseURL}/auth/technician/jobs/${jobId}/photos/${photoId}`;
const lines = (value) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
const finalTestItems = [
  'Brakes',
  'Steering',
  'Lights and signals',
  'Tyres and wheels',
  'Fluid leaks',
  'Road test',
];

async function preparePhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  for (const quality of [0.7, 0.58, 0.45]) {
    if (blob?.size <= 1.4 * 1024 * 1024) break;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  if (!blob || blob.size > 1.4 * 1024 * 1024)
    throw new Error('This image is too large to upload. Choose a smaller photo.');
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
  const [timerNow, setTimerNow] = useState(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState('');
  const [partSearch, setPartSearch] = useState('');
  const [partSuggestions, setPartSuggestions] = useState([]);
  const [partForm, setPartForm] = useState({
    name: '',
    partNumber: '',
    quantity: '1',
    unitCost: '',
  });
  const [additionalParts, setAdditionalParts] = useState([
    { name: '', quantity: '1', unitCost: '' },
  ]);
  const [additionalPhotoIds, setAdditionalPhotoIds] = useState([]);
  const [additionalLabourCost, setAdditionalLabourCost] = useState('0');
  const [customerStatusUpdate, setCustomerStatusUpdate] = useState('');
  const [finalReportNotes, setFinalReportNotes] = useState('');
  const [evidenceType, setEvidenceType] = useState('Before Repair');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const activeTimerStartedAt = result?.job?.activeLabourTimer?.startedAt;

  useEffect(() => {
    if (!activeTimerStartedAt) return undefined;
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeTimerStartedAt]);

  const loadJob = useCallback(
    async (signal) => {
      const { data } = await api.get(`/auth/technician/jobs/${jobId}`, { signal });
      return data.job;
    },
    [jobId],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadJob(controller.signal)
      .then((job) => {
        if (!controller.signal.aborted) {
          // oxlint-disable-next-line react(set-state-in-effect) -- Store the response from an async data fetch.
          setResult({ jobId, job });
        }
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          // oxlint-disable-next-line react(set-state-in-effect) -- Store the result of the failed async API request.
          setResult({
            jobId,
            error: requestError.response?.data?.message || 'Unable to load this service job.',
          });
        }
      });
    return () => controller.abort();
  }, [jobId, retry, loadJob]);

  useEffect(() => {
    if (partSearch.trim().length < 2) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        api
          .get('/auth/technician/parts', {
            params: { search: partSearch },
            signal: controller.signal,
          })
          .then(({ data }) => {
            if (!controller.signal.aborted) setPartSuggestions(data.parts || []);
          })
          .catch(() => {
            if (!controller.signal.aborted) setPartSuggestions([]);
          }),
      200,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [partSearch]);

  async function updateCard(action, payload = {}) {
    if (busy) return false;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch(`/auth/technician/jobs/${jobId}/card`, {
        action,
        ...payload,
      });
      setNotice(data.message);
      setResult({ jobId, job: await loadJob() });
      return true;
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save this job card update.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitForm(event, action, buildPayload) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (await updateCard(action, buildPayload(form))) formElement.reset();
  }

  async function uploadPhoto(event, category = 'Job', evidence = {}) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    setError('');
    setNotice('');
    try {
      const photo = await preparePhoto(file);
      const { data } = await api.post(
        `/auth/technician/jobs/${jobId}/photos`,
        { ...photo, category, ...evidence },
        { timeout: 30000 },
      );
      if (category === 'RepairEvidence')
        setAdditionalPhotoIds((ids) => [...ids, data.photo.id].slice(0, 3));
      setNotice(`${data.photo.filename} uploaded.`);
      setResult({ jobId, job: await loadJob() });
      return true;
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to upload this photo.',
      );
      return false;
    } finally {
      setPhotoBusy(false);
      event.target.value = '';
    }
  }

  const current = result?.jobId === jobId ? result : null;
  if (!current)
    return (
      <main className="technician-jobs-page" role="status">
        Loading service job…
      </main>
    );
  if (current.error)
    return (
      <main className="technician-jobs-page">
        <p role="alert">{current.error}</p>
        <button
          className="btn-primary"
          type="button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Try again
        </button>
        <Link className="technician-back-link" to="/technician/jobs">
          Back to My Jobs
        </Link>
      </main>
    );
  const { job } = current;
  const vehicleLabel = job.vehicle
    ? `${job.vehicle.year ? `${job.vehicle.year} ` : ''}${job.vehicle.make} ${job.vehicle.model}${job.vehicle.registrationNumber ? ` · ${job.vehicle.registrationNumber}` : ''}`
    : 'Vehicle details unavailable';
  const nextStatus = {
    Inspecting: 'In Progress',
    'In Progress': 'Final Test',
    'Final Test': 'Ready',
  }[job.status];
  const pendingApproval = job.additionalRepairs?.some((repair) => repair.status === 'Pending');
  const visiblePartSuggestions = partSearch.trim().length >= 2 ? partSuggestions : [];
  const activeLabourTimer = job.activeLabourTimer;

  return (
    <main className="technician-jobs-page technician-job-card-page">
      <Link className="technician-back-link" to="/technician/jobs">
        ← Back to My Jobs
      </Link>
      <header className="technician-jobs-heading technician-job-detail-heading">
        <div>
          <p className="technician-jobs-eyebrow">DIGITAL JOB CARD</p>
          <h1 className="page-title">{job.serviceNumber}</h1>
          <p className="page-subtitle">{vehicleLabel}</p>
        </div>
        <span className="badge badge-warning">{job.status}</span>
      </header>
      {error && (
        <div className="technician-card-message error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="technician-card-message success" role="status">
          {notice}
        </div>
      )}
      <section className="section-card technician-job-detail-card">
        <h2>Job overview</h2>
        <dl className="technician-job-detail-grid">
          <div>
            <dt>Priority</dt>
            <dd>
              <span className={`technician-priority ${job.priority.toLowerCase()}`}>
                {job.priority}
              </span>
            </dd>
          </div>
          <div>
            <dt>Service type</dt>
            <dd>{job.serviceType}</dd>
          </div>
          <div>
            <dt>Expected completion</dt>
            <dd>{dateTime(job.expectedCompletionTime)}</dd>
          </div>
          <div>
            <dt>Customer</dt>
            <dd>
              {job.customer.name}
              {job.customer.mobile ? ` · ${job.customer.mobile}` : ''}
            </dd>
          </div>
          <div>
            <dt>Vehicle</dt>
            <dd>{vehicleLabel}</dd>
          </div>
          <div>
            <dt>Assigned technician</dt>
            <dd>{job.assignedTechnician}</dd>
          </div>
          <div>
            <dt>Appointment</dt>
            <dd>
              {job.appointment
                ? `${dateTime(job.appointment.preferredDate)}${job.appointment.preferredTime ? ` · ${job.appointment.preferredTime}` : ''}`
                : 'No appointment linked'}
            </dd>
          </div>
          <div>
            <dt>Appointment status</dt>
            <dd>{job.appointment?.status || 'Not available'}</dd>
          </div>
        </dl>
        {job.complaint && (
          <div className="technician-job-detail-section">
            <h3>Customer complaint</h3>
            <p>{job.complaint}</p>
          </div>
        )}
        {job.appointment?.problemDescription && (
          <div className="technician-job-detail-section">
            <h3>Appointment notes</h3>
            <p>{job.appointment.problemDescription}</p>
          </div>
        )}
      </section>

      <section className="section-card technician-card-section">
        <header>
          <div>
            <h2>Inspection and diagnosis</h2>
            <p>Record findings, diagnosis, issues, and repair recommendations.</p>
          </div>
          {job.inspection?.completedAt && (
            <span className="technician-card-complete">Inspection completed</span>
          )}
        </header>
        {!job.inspection?.startedAt && (
          <button
            className="technician-inspection-start"
            type="button"
            disabled={busy || job.status !== 'Inspecting'}
            onClick={() => updateCard('inspectionStart')}
          >
            {busy ? 'Starting…' : 'Start inspection'}
          </button>
        )}
        {job.inspection?.startedAt && (
          <p className="technician-inspection-time">
            Started {dateTime(job.inspection.startedAt)}
            {job.inspection.completedAt
              ? ` · Completed ${dateTime(job.inspection.completedAt)}`
              : ''}
          </p>
        )}
        <form
          onSubmit={(event) =>
            submitForm(event, 'inspection', (form) => ({
              findings: form.get('findings'),
              diagnosis: form.get('diagnosis'),
              notes: form.get('notes'),
              issues: lines(form.get('issues')),
              recommendedRepairs: lines(form.get('recommendedRepairs')),
            }))
          }
        >
          <fieldset
            disabled={!job.inspection?.startedAt || Boolean(job.inspection?.completedAt) || busy}
          >
            <label>
              Inspection findings
              <textarea
                name="findings"
                maxLength={5000}
                defaultValue={job.inspection?.findings || ''}
                rows={3}
              />
            </label>
            <label>
              Diagnosis
              <textarea
                name="diagnosis"
                maxLength={5000}
                defaultValue={job.inspection?.diagnosis || ''}
                rows={3}
              />
            </label>
            <label>
              Issues found
              <textarea
                name="issues"
                maxLength={3000}
                defaultValue={(job.inspection?.issues || []).join('\n')}
                placeholder="One issue per line"
                rows={3}
              />
            </label>
            <label>
              Recommended repairs
              <textarea
                name="recommendedRepairs"
                maxLength={3000}
                defaultValue={(job.inspection?.recommendedRepairs || []).join('\n')}
                placeholder="One recommendation per line"
                rows={3}
              />
            </label>
            <label>
              Inspection notes
              <textarea
                name="notes"
                maxLength={5000}
                defaultValue={job.inspection?.notes || ''}
                rows={3}
              />
            </label>
            <button type="submit">Save inspection</button>
            {!job.inspection?.completedAt && job.inspection?.startedAt && (
              <button
                type="button"
                onClick={(event) => {
                  const form = new FormData(event.currentTarget.form);
                  updateCard('inspection', {
                    findings: form.get('findings'),
                    diagnosis: form.get('diagnosis'),
                    notes: form.get('notes'),
                    issues: lines(form.get('issues')),
                    recommendedRepairs: lines(form.get('recommendedRepairs')),
                    complete: true,
                  });
                }}
              >
                Mark inspection complete
              </button>
            )}
          </fieldset>
        </form>
        <div className="technician-inspection-images">
          <div>
            <h3>Inspection images</h3>
            <p>Attach photos taken during this vehicle inspection.</p>
          </div>
          <label className="technician-photo-picker">
            {photoBusy ? 'Uploading photo…' : 'Add inspection image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={
                !job.inspection?.startedAt ||
                Boolean(job.inspection?.completedAt) ||
                photoBusy ||
                (job.photos?.length || 0) >= 12
              }
              onChange={(event) => uploadPhoto(event, 'Inspection')}
            />
          </label>
        </div>
        {job.photos?.some((photo) => photo.category === 'Inspection') ? (
          <div className="technician-photo-grid">
            {job.photos
              .filter((photo) => photo.category === 'Inspection')
              .map((photo) => (
                <figure key={photo.id}>
                  <img src={imageUrl(job.id, photo.id)} alt={photo.filename} loading="lazy" />
                  <figcaption>
                    {photo.filename}
                    <small>{dateTime(photo.createdAt)}</small>
                  </figcaption>
                </figure>
              ))}
          </div>
        ) : (
          <p className="technician-card-empty">No inspection images attached.</p>
        )}
      </section>

      <section className="section-card technician-card-section">
        <header>
          <div>
            <h2>Diagnostic report</h2>
            <p>
              Record the fault, issue category, recommended action, severity, and estimated repair
              time.
            </p>
          </div>
          {job.diagnosticReport?.updatedAt && (
            <span className="technician-card-complete">
              Updated {dateTime(job.diagnosticReport.updatedAt)}
            </span>
          )}
        </header>
        <form
          onSubmit={(event) =>
            submitForm(event, 'diagnosticReport', (form) => ({
              result: form.get('result'),
              issueCategory: form.get('issueCategory'),
              faultDescription: form.get('faultDescription'),
              recommendedAction: form.get('recommendedAction'),
              severity: form.get('severity'),
              estimatedRepairHours: form.get('estimatedRepairHours'),
            }))
          }
        >
          <label>
            Diagnostic result
            <textarea
              name="result"
              required
              maxLength={5000}
              rows={3}
              defaultValue={job.diagnosticReport?.result || job.inspection?.diagnosis || ''}
            />
          </label>
          <label>
            Issue category
            <select
              name="issueCategory"
              defaultValue={job.diagnosticReport?.issueCategory || 'Other'}
            >
              {[
                'Engine',
                'Transmission',
                'Brakes',
                'Electrical',
                'Suspension',
                'Cooling',
                'Exhaust',
                'Tyres',
                'Body',
                'Other',
              ].map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Fault description
            <textarea
              name="faultDescription"
              required
              maxLength={5000}
              rows={3}
              defaultValue={
                job.diagnosticReport?.faultDescription || job.inspection?.findings || ''
              }
            />
          </label>
          <label>
            Recommended action
            <textarea
              name="recommendedAction"
              required
              maxLength={5000}
              rows={3}
              defaultValue={
                job.diagnosticReport?.recommendedAction ||
                (job.inspection?.recommendedRepairs || []).join('\n')
              }
            />
          </label>
          <label>
            Severity
            <select name="severity" defaultValue={job.diagnosticReport?.severity || 'Medium'}>
              {['Low', 'Medium', 'High', 'Critical'].map((severity) => (
                <option key={severity}>{severity}</option>
              ))}
            </select>
          </label>
          <label>
            Estimated repair time (hours)
            <input
              name="estimatedRepairHours"
              type="number"
              min="0.02"
              max="168"
              step="0.01"
              required
              defaultValue={
                job.diagnosticReport?.estimatedRepairMinutes
                  ? (job.diagnosticReport.estimatedRepairMinutes / 60).toFixed(2)
                  : ''
              }
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy
              ? 'Saving…'
              : job.diagnosticReport?.updatedAt
                ? 'Update diagnostic report'
                : 'Save diagnostic report'}
          </button>
        </form>
      </section>

      <section className="section-card technician-card-section">
        <header>
          <div>
            <h2>Repair notes</h2>
            <p>Notes are saved with your technician account and timestamp.</p>
          </div>
        </header>
        <form
          className="technician-card-inline-form"
          onSubmit={(event) =>
            submitForm(event, 'repairNote', (form) => ({ note: form.get('note') }))
          }
        >
          <label>
            Add a repair note
            <textarea name="note" required maxLength={2000} rows={3} />
          </label>
          <button type="submit" disabled={busy}>
            Add note
          </button>
        </form>
        {job.repairNotes?.length > 0 && (
          <ul className="technician-card-note-list">
            {[...job.repairNotes].reverse().map((note) => (
              <li key={note.id}>
                <p>{note.note}</p>
                <small>{dateTime(note.createdAt)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section-card technician-card-section">
        <header>
          <div>
            <h2>Repair tasks</h2>
            <p>Track the work required to complete this job.</p>
          </div>
          <span>
            {job.tasks?.filter((task) => task.status === 'Complete').length || 0} /{' '}
            {job.tasks?.length || 0} complete
          </span>
        </header>
        <form
          className="technician-card-inline-form"
          onSubmit={(event) =>
            submitForm(event, 'taskAdd', (form) => ({
              title: form.get('title'),
              notes: form.get('notes'),
            }))
          }
        >
          <label>
            New task
            <input name="title" required maxLength={200} />
          </label>
          <label>
            Notes
            <input name="notes" maxLength={1000} />
          </label>
          <button type="submit" disabled={busy}>
            Add task
          </button>
        </form>
        {job.tasks?.length ? (
          <div className="technician-card-task-list">
            {job.tasks.map((task) => (
              <article key={task.id}>
                {editingTaskId === task.id ? (
                  <form
                    className="technician-task-edit-form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      if (
                        await updateCard('taskUpdate', {
                          taskId: task.id,
                          status: task.status,
                          title: form.get('title'),
                          notes: form.get('notes'),
                        })
                      )
                        setEditingTaskId('');
                    }}
                  >
                    <label>
                      Task title
                      <input name="title" required maxLength={200} defaultValue={task.title} />
                    </label>
                    <label>
                      Task notes
                      <textarea
                        name="notes"
                        maxLength={1000}
                        rows={2}
                        defaultValue={task.notes || ''}
                      />
                    </label>
                    <div>
                      <button type="submit" disabled={busy}>
                        Save task
                      </button>
                      <button
                        type="button"
                        className="technician-task-cancel"
                        disabled={busy}
                        onClick={() => setEditingTaskId('')}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="technician-task-summary">
                    <strong>{task.title}</strong>
                    {task.notes && <p>{task.notes}</p>}
                    {task.completedAt && <small>Completed {dateTime(task.completedAt)}</small>}
                    <button type="button" disabled={busy} onClick={() => setEditingTaskId(task.id)}>
                      Edit task
                    </button>
                  </div>
                )}
                <div className="technician-task-status">
                  <label className="sr-only" htmlFor={`task-${task.id}`}>
                    Status for {task.title}
                  </label>
                  <select
                    id={`task-${task.id}`}
                    value={task.status}
                    disabled={busy || task.status === 'Cancelled'}
                    onChange={(event) =>
                      updateCard('taskUpdate', { taskId: task.id, status: event.target.value })
                    }
                  >
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Complete</option>
                    <option>Cancelled</option>
                  </select>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="technician-card-empty">No repair tasks added yet.</p>
        )}
      </section>

      <section className="section-card technician-card-section">
        <header>
          <div>
            <h2>Parts used</h2>
            <p>Record each replaced part and its quantity and unit price.</p>
          </div>
        </header>
        <form
          className="technician-part-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await updateCard('partAdd', partForm)) {
              setPartForm({ name: '', partNumber: '', quantity: '1', unitCost: '' });
              setPartSearch('');
              setPartSuggestions([]);
            }
          }}
        >
          <div className="technician-part-search">
            <label>
              Search previously used parts
              <input
                type="search"
                value={partSearch}
                maxLength={80}
                placeholder="Part name or part number"
                onChange={(event) => {
                  setPartSearch(event.target.value);
                  setPartSuggestions([]);
                }}
              />
            </label>
            {visiblePartSuggestions.length > 0 && (
              <div
                className="technician-part-suggestions"
                role="listbox"
                aria-label="Matching previously used parts"
              >
                {visiblePartSuggestions.map((part) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    key={part.id}
                    onClick={() => {
                      setPartForm((current) => ({
                        ...current,
                        name: part.name,
                        partNumber: part.partNumber,
                        unitCost: String(part.unitPrice),
                      }));
                      setPartSearch(part.name);
                      setPartSuggestions([]);
                    }}
                  >
                    <strong>{part.name}</strong>
                    <span>
                      {part.partNumber || 'No part number'} · Unit price{' '}
                      {Number(part.unitPrice || 0).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {partSearch.trim().length >= 2 && partSuggestions.length === 0 && (
              <small className="technician-part-search-hint">
                No previous match. Enter the part details manually below.
              </small>
            )}
          </div>
          <div className="technician-part-fields">
            <label>
              Part name
              <input
                required
                maxLength={200}
                value={partForm.name}
                onChange={(event) =>
                  setPartForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label>
              Part number
              <input
                maxLength={100}
                value={partForm.partNumber}
                onChange={(event) =>
                  setPartForm((current) => ({ ...current, partNumber: event.target.value }))
                }
              />
            </label>
            <label>
              Quantity
              <input
                type="number"
                min="0.01"
                step="any"
                required
                value={partForm.quantity}
                onChange={(event) =>
                  setPartForm((current) => ({ ...current, quantity: event.target.value }))
                }
              />
            </label>
            <label>
              Unit price
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={partForm.unitCost}
                onChange={(event) =>
                  setPartForm((current) => ({ ...current, unitCost: event.target.value }))
                }
              />
            </label>
          </div>
          <button type="submit" disabled={busy}>
            Add used part
          </button>
        </form>
        {job.replacedParts?.length ? (
          <div className="technician-card-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Number</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Line total</th>
                  <th>Recorded</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {job.replacedParts.map((part) => (
                  <tr key={part.id}>
                    <td>{part.name}</td>
                    <td>{part.partNumber || '—'}</td>
                    <td>{part.quantity}</td>
                    <td>{Number(part.unitCost || 0).toFixed(2)}</td>
                    <td>{Number(part.totalCost || 0).toFixed(2)}</td>
                    <td>{dateTime(part.replacedAt)}</td>
                    <td>
                      <button
                        className="technician-part-remove"
                        type="button"
                        disabled={busy}
                        onClick={() => updateCard('partRemove', { partId: part.id })}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="technician-parts-total">
                  <th colSpan="4">Parts total</th>
                  <td>{Number(job.partsCost || 0).toFixed(2)}</td>
                  <td colSpan="2" />
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="technician-card-empty">No parts recorded yet.</p>
        )}
      </section>

      <section className="section-card technician-card-section">
        <header>
          <div>
            <h2>Labour tracking</h2>
            <p>
              Track work with a timer or enter time manually. Charges use each entry’s hourly rate.
            </p>
          </div>
          <strong>
            {((job.labourMinutes || 0) / 60).toFixed(2)} hours ·{' '}
            {Number(job.labourCost || 0).toFixed(2)} total
          </strong>
        </header>
        {activeLabourTimer ? (
          <div className="technician-inspection-time">
            <strong>
              {activeLabourTimer.labourType}: {activeLabourTimer.description}
            </strong>
            <span>
              {' '}
              ·{' '}
              {Math.floor(
                Math.max(0, timerNow - new Date(activeLabourTimer.startedAt).getTime()) / 60000,
              )}{' '}
              min elapsed · Rate {Number(activeLabourTimer.ratePerHour || 0).toFixed(2)}/hour
            </span>
            <button
              type="button"
              disabled={busy || activeLabourTimer.technician !== job.currentTechnicianId}
              onClick={() => updateCard('labourTimerStop')}
            >
              Stop timer
            </button>
          </div>
        ) : (
          <form
            className="technician-card-inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              updateCard('labourTimerStart', {
                description: form.get('description'),
                labourType: form.get('labourType'),
                ratePerHour: form.get('ratePerHour'),
              });
            }}
          >
            <label>
              Timer work
              <input name="description" maxLength={200} placeholder="Repair labour" />
            </label>
            <label>
              Labour type
              <select name="labourType">
                <option>Repair</option>
                <option>Inspection</option>
                <option>Diagnostics</option>
                <option>Testing</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Hourly rate
              <input
                name="ratePerHour"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              Start timer
            </button>
          </form>
        )}
        <form
          className="technician-card-inline-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            if (
              await updateCard('labourAdd', {
                description: form.get('description'),
                labourType: form.get('labourType'),
                hours: labourHours,
                ratePerHour: form.get('ratePerHour'),
              })
            ) {
              setLabourHours('');
              event.currentTarget.reset();
            }
          }}
        >
          <label>
            Work description
            <input name="description" maxLength={200} placeholder="Repair labour" />
          </label>
          <label>
            Labour type
            <select name="labourType">
              <option>Repair</option>
              <option>Inspection</option>
              <option>Diagnostics</option>
              <option>Testing</option>
              <option>Other</option>
            </select>
          </label>
          <label>
            Hours
            <input
              type="number"
              min="0.01"
              max="24"
              step="0.01"
              required
              value={labourHours}
              onChange={(event) => setLabourHours(event.target.value)}
            />
          </label>
          <label>
            Hourly rate
            <input name="ratePerHour" type="number" min="0" step="0.01" defaultValue="0" required />
          </label>
          <button type="submit" disabled={busy}>
            Record manual time
          </button>
        </form>
        {job.labourEntries?.length > 0 && (
          <ul className="technician-card-note-list">
            {[...job.labourEntries].reverse().map((entry) => (
              <li key={entry.id}>
                <p>
                  <strong>
                    {entry.labourType} · {entry.description}
                  </strong>{' '}
                  · {(entry.minutes / 60).toFixed(2)} hours · {Number(entry.charge || 0).toFixed(2)}
                </p>
                <small>
                  {entry.technician === job.currentTechnicianId ? 'You' : 'Technician'} ·{' '}
                  {dateTime(entry.recordedAt)}
                  {entry.startedAt && entry.endedAt
                    ? ` · ${dateTime(entry.startedAt)}–${dateTime(entry.endedAt)}`
                    : ''}{' '}
                  · {Number(entry.ratePerHour || 0).toFixed(2)}/hour
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section-card technician-card-section">
        <header>
          <div>
            <h2>Job photos</h2>
            <p>Upload JPEG, PNG, or WebP photos. Images are resized and limited to 1.4 MB.</p>
          </div>
          <span>{job.photos?.length || 0} / 12 total</span>
        </header>
        <label className="technician-photo-picker">
          {photoBusy ? 'Uploading photo…' : 'Choose a job photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={photoBusy || (job.photos?.length || 0) >= 12}
            onChange={(event) => uploadPhoto(event, 'Job')}
          />
        </label>
        {job.photos?.some((photo) => photo.category === 'Job') ? (
          <div className="technician-photo-grid">
            {job.photos
              .filter((photo) => photo.category === 'Job')
              .map((photo) => (
                <figure key={photo.id}>
                  <img src={imageUrl(job.id, photo.id)} alt={photo.filename} loading="lazy" />
                  <figcaption>
                    {photo.filename}
                    <small>{dateTime(photo.createdAt)}</small>
                  </figcaption>
                </figure>
              ))}
          </div>
        ) : (
          <p className="technician-card-empty">No general job photos attached.</p>
        )}
      </section>

      <section className="section-card technician-card-section">
        <header>
          <div>
            <h2>Repair evidence</h2>
            <p>
              Upload and review before-repair, damaged-part, and after-repair photos linked to this
              service job.
            </p>
          </div>
        </header>
        <div className="technician-repair-evidence-form">
          <label>
            Evidence type
            <select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)}>
              <option>Before Repair</option>
              <option>Damaged Part</option>
              <option>After Repair</option>
            </select>
          </label>
          <label>
            Image description
            <input
              required
              maxLength={300}
              value={evidenceDescription}
              onChange={(event) => setEvidenceDescription(event.target.value)}
              placeholder="Describe what this image shows"
            />
          </label>
          <label className="technician-photo-picker">
            {photoBusy ? 'Uploading evidence…' : 'Choose evidence photo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={photoBusy || !evidenceDescription.trim() || (job.photos?.length || 0) >= 12}
              onChange={async (event) => {
                if (
                  await uploadPhoto(event, 'RepairEvidence', {
                    evidenceType,
                    description: evidenceDescription,
                  })
                )
                  setEvidenceDescription('');
              }}
            />
          </label>
        </div>
        {job.photos?.some(
          (photo) =>
            photo.category === 'RepairEvidence' && photo.evidenceType !== 'Additional Repair',
        ) ? (
          <div className="technician-photo-grid">
            {job.photos
              .filter(
                (photo) =>
                  photo.category === 'RepairEvidence' && photo.evidenceType !== 'Additional Repair',
              )
              .map((photo) => (
                <figure key={photo.id}>
                  <img
                    src={imageUrl(job.id, photo.id)}
                    alt={photo.description || photo.filename}
                    loading="lazy"
                  />
                  <figcaption>
                    <strong>{photo.evidenceType}</strong>
                    <p>{photo.description || 'No description'}</p>
                    <small>
                      {photo.filename} · {dateTime(photo.createdAt)}
                    </small>
                  </figcaption>
                </figure>
              ))}
          </div>
        ) : (
          <p className="technician-card-empty">No repair evidence uploaded yet.</p>
        )}
      </section>

      <section className="section-card technician-card-section">
        <header>
          <div>
            <h2>Customer approval</h2>
            <p>Request approval before performing additional repair work.</p>
          </div>
        </header>
        {job.additionalRepairs?.length > 0 && (
          <ul className="technician-card-note-list">
            {[...job.additionalRepairs].reverse().map((repair) => (
              <li key={repair.id}>
                <p>
                  <strong>{repair.description}</strong> · {repair.status}
                  {repair.estimatedCost != null
                    ? ` · Estimated ${Number(repair.estimatedCost).toFixed(2)}`
                    : ''}
                </p>
                {repair.technicianExplanation && <p>{repair.technicianExplanation}</p>}
                {repair.customerComment && (
                  <p>
                    <strong>Customer comment:</strong> {repair.customerComment}
                  </p>
                )}
                <small>
                  {repair.status === 'Pending'
                    ? 'Awaiting customer decision'
                    : `${repair.status} ${dateTime(repair.decisionAt)}`}{' '}
                  · Requested {dateTime(repair.requestedAt)}
                  {repair.relatedTask
                    ? ` · Related task ${job.tasks?.find((task) => task.id === repair.relatedTask)?.title || ''}`
                    : ''}
                </small>
              </li>
            ))}
          </ul>
        )}
        <form
          className="technician-card-approval-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            if (
              await updateCard('approvalRequest', {
                description: form.get('description'),
                explanation: form.get('explanation'),
                relatedTaskId: form.get('relatedTaskId'),
                parts: additionalParts.filter((part) => part.name.trim()),
                labourCost: form.get('labourCost'),
                photoIds: additionalPhotoIds,
              })
            ) {
              event.currentTarget.reset();
              setAdditionalParts([{ name: '', quantity: '1', unitCost: '' }]);
              setAdditionalPhotoIds([]);
              setAdditionalLabourCost('0');
            }
          }}
        >
          <label>
            Additional problem
            <input name="description" required maxLength={2000} />
          </label>
          <label>
            Repair description and reason
            <textarea
              name="explanation"
              required
              maxLength="3000"
              rows={3}
              placeholder="Describe the issue found and why this repair is needed."
            />
          </label>
          <div className="technician-additional-parts">
            <strong>Estimated parts</strong>
            {additionalParts.map((part, index) => (
              <div className="technician-additional-part-row" key={index}>
                <label>
                  Part
                  <input
                    value={part.name}
                    maxLength={200}
                    onChange={(event) =>
                      setAdditionalParts((rows) =>
                        rows.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, name: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Qty
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={part.quantity}
                    onChange={(event) =>
                      setAdditionalParts((rows) =>
                        rows.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, quantity: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Unit cost
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={part.unitCost}
                    onChange={(event) =>
                      setAdditionalParts((rows) =>
                        rows.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, unitCost: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="technician-task-cancel"
                  disabled={additionalParts.length === 1}
                  onClick={() =>
                    setAdditionalParts((rows) => rows.filter((_, rowIndex) => rowIndex !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={additionalParts.length >= 20}
              onClick={() =>
                setAdditionalParts((rows) => [...rows, { name: '', quantity: '1', unitCost: '' }])
              }
            >
              Add part
            </button>
          </div>
          <label>
            Related repair task
            <select name="relatedTaskId" defaultValue="">
              <option value="">No related task</option>
              {(job.tasks || [])
                .filter((task) => task.status !== 'Cancelled')
                .map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Estimated labour cost
            <input
              name="labourCost"
              type="number"
              min="0"
              step="0.01"
              value={additionalLabourCost}
              onChange={(event) => setAdditionalLabourCost(event.target.value)}
              required
            />
          </label>
          <strong>
            Estimated additional total:{' '}
            {(
              additionalParts.reduce(
                (sum, part) => sum + (Number(part.quantity) || 0) * (Number(part.unitCost) || 0),
                0,
              ) + (Number(additionalLabourCost) || 0)
            ).toFixed(2)}
          </strong>
          <div className="technician-additional-photos">
            <label className="technician-photo-picker">
              {photoBusy ? 'Uploading…' : `Add supporting image (${additionalPhotoIds.length}/3)`}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={
                  photoBusy || additionalPhotoIds.length >= 3 || (job.photos?.length || 0) >= 12
                }
                onChange={(event) =>
                  uploadPhoto(event, 'RepairEvidence', {
                    evidenceType: 'Additional Repair',
                    description: 'Supporting image for additional repair approval.',
                  })
                }
              />
            </label>
            <small>
              Upload up to 3 images. They will be shared with the customer for this approval
              request.
            </small>
          </div>
          <button
            type="submit"
            disabled={
              busy ||
              photoBusy ||
              pendingApproval ||
              !['Inspecting', 'In Progress'].includes(job.status)
            }
          >
            {pendingApproval ? 'Approval pending' : 'Send for customer approval'}
          </button>
        </form>
      </section>

      <section className="section-card technician-card-section">
        <header>
          <div>
            <h2>Final vehicle test</h2>
            <p>Record safety checks and road-test results before marking the vehicle Ready.</p>
          </div>
          {job.finalTest?.result && (
            <span
              className={
                job.finalTest.result === 'Passed'
                  ? 'technician-card-complete'
                  : 'technician-card-hint'
              }
            >
              {job.finalTest.result}
            </span>
          )}
        </header>
        {job.status !== 'Final Test' && !job.finalTest?.result && (
          <p className="technician-card-empty">
            Move the job to Final Test after completing or cancelling all repair tasks.
          </p>
        )}
        {job.status === 'Final Test' &&
          (!job.finalTest?.startedAt || job.finalTest?.completedAt) && (
            <button type="button" disabled={busy} onClick={() => updateCard('finalTestStart')}>
              {job.finalTest?.result === 'Failed' ? 'Restart final test' : 'Start final test'}
            </button>
          )}
        {job.status === 'Final Test' && job.finalTest?.startedAt && !job.finalTest?.completedAt && (
          <form
            className="technician-final-test-form"
            onSubmit={(event) =>
              submitForm(event, 'finalTestComplete', (form) => ({
                checklist: finalTestItems.map((item) => ({
                  item,
                  result: form.get(`result-${item}`),
                  notes: form.get(`note-${item}`),
                })),
                notes: form.get('notes'),
                unresolvedIssue: form.get('unresolvedIssue'),
              }))
            }
          >
            <p>Started {dateTime(job.finalTest.startedAt)}. Each check needs a result.</p>
            <div className="technician-final-test-checklist">
              {finalTestItems.map((item) => (
                <fieldset key={item}>
                  <legend>{item}</legend>
                  <label>
                    Result
                    <select name={`result-${item}`} required defaultValue="">
                      <option value="">Choose result</option>
                      <option>Passed</option>
                      <option>Failed</option>
                    </select>
                  </label>
                  <label>
                    Notes
                    <input name={`note-${item}`} maxLength={500} />
                  </label>
                </fieldset>
              ))}
            </div>
            <label>
              Final test notes
              <textarea name="notes" maxLength={2000} rows={3} />
            </label>
            <label>
              Unresolved issue
              <textarea
                name="unresolvedIssue"
                maxLength={2000}
                rows={2}
                placeholder="Leave blank if there are no unresolved issues."
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Complete final test'}
            </button>
          </form>
        )}
        {job.finalTest?.completedAt && (
          <div className="technician-final-test-result">
            <p>
              <strong>{job.finalTest.result}</strong> · Completed{' '}
              {dateTime(job.finalTest.completedAt)}
            </p>
            {job.finalTest.notes && <p>{job.finalTest.notes}</p>}
            {job.finalTest.unresolvedIssue && (
              <p>
                <strong>Unresolved issue:</strong> {job.finalTest.unresolvedIssue}
              </p>
            )}
            <ul>
              {(job.finalTest.checklist || []).map((check) => (
                <li key={check.item}>
                  <strong>{check.item}:</strong> {check.result}
                  {check.notes ? ` · ${check.notes}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        {job.finalReport?.completedAt && (
          <div className="technician-final-test-result">
            <p>
              <strong>Final technician report</strong> · {dateTime(job.finalReport.completedAt)}
            </p>
            <p>{job.finalReport.notes}</p>
            {job.billingInvoice && (
              <p>
                Draft invoice sent to billing:{' '}
                {job.billingInvoice.invoiceNumber || job.billingInvoice.id}
                {job.billingInvoice.totalAmount != null
                  ? ` · ${Number(job.billingInvoice.totalAmount).toFixed(2)}`
                  : ''}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="section-card technician-card-section">
        <header>
          <div>
            <h2>Update job status</h2>
            <p>Job status changes are added to the service history.</p>
          </div>
        </header>
        {nextStatus === 'Ready' ? (
          <form
            className="technician-job-complete-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              if (
                await updateCard('completeJob', {
                  tasksVerified: form.get('tasksVerified') === 'on',
                  partsVerified: form.get('partsVerified') === 'on',
                  labourVerified: form.get('labourVerified') === 'on',
                  reportNotes: finalReportNotes,
                })
              )
                setFinalReportNotes('');
            }}
          >
            <p>
              Review the task list, used parts, and labour entries above before completing the job.
            </p>
            <label>
              <input type="checkbox" name="tasksVerified" required /> All repair tasks are complete
              or cancelled
            </label>
            <label>
              <input type="checkbox" name="partsVerified" required /> Used parts and quantities are
              verified
            </label>
            <label>
              <input type="checkbox" name="labourVerified" required /> Labour time and charges are
              verified
            </label>
            <label>
              Final technician report
              <textarea
                required
                maxLength={3000}
                rows={4}
                value={finalReportNotes}
                onChange={(event) => setFinalReportNotes(event.target.value)}
                placeholder="Summarize the completed work and anything the service team should know."
              />
            </label>
            <button
              type="submit"
              disabled={
                busy ||
                job.finalTest?.result !== 'Passed' ||
                !job.finalTest?.completedAt ||
                job.tasks?.some((task) => !['Complete', 'Cancelled'].includes(task.status)) ||
                pendingApproval ||
                Boolean(job.activeLabourTimer?.startedAt)
              }
            >
              {busy ? 'Completing…' : 'Complete job, notify, and send to billing'}
            </button>
          </form>
        ) : nextStatus ? (
          <form
            className="technician-status-update-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await updateCard('status', { status: nextStatus, notes: customerStatusUpdate }))
                setCustomerStatusUpdate('');
            }}
          >
            <label>
              Update for customer
              <textarea
                required
                maxLength={1000}
                rows={3}
                value={customerStatusUpdate}
                onChange={(event) => setCustomerStatusUpdate(event.target.value)}
                placeholder="Share a brief update that will appear in repair tracking and the customer notification."
              />
            </label>
            <button
              type="submit"
              disabled={
                busy ||
                !customerStatusUpdate.trim() ||
                (nextStatus === 'Final Test' &&
                  job.tasks?.some((task) => !['Complete', 'Cancelled'].includes(task.status)))
              }
            >
              {busy ? 'Saving…' : `Move to ${nextStatus} and notify customer`}
            </button>
          </form>
        ) : (
          <p className="technician-card-empty">
            {job.status === 'Waiting for Approval'
              ? 'This job will return to repair when the customer responds.'
              : 'This job is at its final workflow stage.'}
          </p>
        )}
        {nextStatus === 'Final Test' &&
          job.tasks?.some((task) => !['Complete', 'Cancelled'].includes(task.status)) && (
            <p className="technician-card-hint">
              Complete or cancel all repair tasks before final testing.
            </p>
          )}
        {nextStatus === 'Ready' &&
          (job.finalTest?.result !== 'Passed' || !job.finalTest?.completedAt) && (
            <p className="technician-card-hint">
              A completed, passing final test is required before this vehicle can be marked Ready.
            </p>
          )}
        {nextStatus === 'Ready' &&
          job.tasks?.some((task) => !['Complete', 'Cancelled'].includes(task.status)) && (
            <p className="technician-card-hint">
              Complete or cancel every task before completing this job.
            </p>
          )}
        {nextStatus === 'Ready' && pendingApproval && (
          <p className="technician-card-hint">
            Resolve pending customer approval requests before completing this job.
          </p>
        )}
        {nextStatus === 'Ready' && job.activeLabourTimer?.startedAt && (
          <p className="technician-card-hint">
            Stop the running labour timer before completing this job.
          </p>
        )}
      </section>

      {job.timeline?.length > 0 && (
        <section className="section-card technician-card-section">
          <header>
            <h2>Job history</h2>
          </header>
          <ol className="technician-job-timeline">
            {[...job.timeline]
              .reverse()
              .slice(0, 10)
              .map((event, index) => (
                <li key={`${event.status}-${index}`}>
                  <strong>{event.status}</strong>
                  <span>{dateTime(event.timestamp)}</span>
                  {event.notes && <p>{event.notes}</p>}
                </li>
              ))}
          </ol>
        </section>
      )}
    </main>
  );
}
