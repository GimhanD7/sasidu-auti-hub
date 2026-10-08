import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import './CustomerRepairTracking.css';

const STAGES = ['Inspecting', 'In Progress', 'Final Test', 'Ready'];
const dateTime = value => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
const vehicleLabel = vehicle => vehicle
  ? `${vehicle.year ? `${vehicle.year} ` : ''}${vehicle.make} ${vehicle.model}${vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ''}`
  : 'Vehicle details unavailable';

function Progress({ status }) {
  const index = status === 'Waiting for Approval' ? 1 : STAGES.indexOf(status);
  return <ol className="tracking-stages" aria-label={`Repair progress: ${status}`}>
    {STAGES.map((stage, i) => <li key={stage} className={`${i < index ? 'is-complete' : ''} ${i === index ? 'is-current' : ''}`}>
      <span className="tracking-stage-dot" aria-hidden="true">{i < index ? '✓' : i + 1}</span><span>{stage}</span>
    </li>)}
  </ol>;
}

function JobCard({ job }) {
  const tasks = job.tasks || [];
  return <article className="tracking-job">
    <header className="tracking-job-header">
      <div><p className="tracking-eyebrow">{job.serviceNumber}</p><h2>{vehicleLabel(job.vehicle)}</h2><p className="tracking-service-type">{job.serviceType}</p></div>
      <span className={`tracking-status ${job.status === 'Ready' ? 'is-ready' : ''}`}>{job.status}</span>
    </header>
    <Progress status={job.status} />
    {job.status === 'Waiting for Approval' && <div className="tracking-notice"><strong>Waiting for approval</strong><p>The workshop has paused this repair while additional work is reviewed.</p><Link to="/customer/repair-approvals">Review additional repair requests</Link></div>}
    {job.status === 'Ready' && <div className="tracking-notice is-ready"><strong>Your vehicle is ready</strong><p>Please contact the workshop to arrange collection.</p></div>}
    <div className="tracking-details">
      <div><span>Technician</span><strong>{job.technician || 'Not assigned'}</strong></div>
      <div><span>Estimated completion</span><strong>{dateTime(job.expectedCompletionTime)}</strong></div>
      <div><span>Priority</span><strong>{job.priority || 'Standard'}</strong></div>
      <div><span>Last updated</span><strong>{dateTime(job.updatedAt)}</strong></div>
    </div>
    {job.customerComplaint && <section className="tracking-complaint"><h3>Reported concern</h3><p>{job.customerComplaint}</p></section>}
    <div className="tracking-lower-grid">
      <section className="tracking-panel"><h3>Repair updates</h3>
        {job.timeline?.length ? <ol className="tracking-timeline">{[...job.timeline].reverse().map((event, i) => <li key={`${event.timestamp || 'update'}-${i}`}><span className="timeline-marker" /><div><strong>{event.status}</strong>{event.notes && <p>{event.notes}</p>}<time>{dateTime(event.timestamp)}</time></div></li>)}</ol> : <p className="tracking-muted">No workshop updates have been recorded yet.</p>}
      </section>
      <section className="tracking-panel"><h3>Repair tasks <span>{tasks.filter(task => task.status === 'Complete').length}/{tasks.length} complete</span></h3>
        {tasks.length ? <ul className="tracking-tasks">{tasks.map(task => <li key={task.id || task.title}><span className={`task-check ${task.status === 'Complete' ? 'done' : ''}`}>{task.status === 'Complete' ? '✓' : '·'}</span><div><strong>{task.title}</strong>{task.notes && <p>{task.notes}</p>}{task.completedAt && <time>Completed {dateTime(task.completedAt)}</time>}</div><span className="task-status">{task.status}</span></li>)}</ul> : <p className="tracking-muted">No repair tasks have been recorded yet.</p>}
      </section>
    </div>
  </article>;
}

export default function CustomerRepairTracking() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async signal => {
    try {
      const { data } = await api.get('/repair-tracking', { signal });
      if (!signal?.aborted) { setJobs(data); setError(''); }
    } catch (err) {
      if (!signal?.aborted) setError(err.response?.data?.message || 'Unable to load repair tracking. Please try again.');
    } finally { if (!signal?.aborted) setRefreshing(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => load(controller.signal), 0);
    const timer = window.setInterval(() => load(), 30000);
    return () => { controller.abort(); window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [load]);
  const refresh = () => { setRefreshing(true); load(); };

  return <main className="customer-tracking-page">
    <div className="tracking-page-heading"><div><p className="tracking-eyebrow">SERVICE WORKSHOP</p><h1>Live Repair Tracking</h1><p>Follow your vehicle’s progress and workshop updates.</p></div><button type="button" className="tracking-refresh" onClick={refresh} disabled={refreshing}>{refreshing ? 'Updating…' : 'Refresh status'}</button></div>
    {error && <div className="tracking-error" role="alert"><span>{error}</span><button type="button" onClick={refresh}>Try again</button></div>}
    {jobs === null && !error && <div className="tracking-loading" role="status">Loading your repair jobs…</div>}
    {jobs?.length === 0 && <section className="tracking-empty"><span aria-hidden="true">🔧</span><h2>No repairs in progress</h2><p>When your vehicle enters the workshop, its status and updates will appear here.</p><Link to="/customer/appointments">View your appointments</Link></section>}
    {jobs?.map(job => <JobCard job={job} key={job.id} />)}
    {jobs?.length > 0 && <p className="tracking-refresh-note">Status refreshes automatically every 30 seconds.</p>}
  </main>;
}
