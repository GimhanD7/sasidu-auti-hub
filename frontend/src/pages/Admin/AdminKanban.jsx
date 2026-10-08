import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import './AdminKanban.css';

const defaultStatuses = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test', 'Ready'];
const priorities = ['Low', 'Normal', 'High', 'Urgent'];
const dateTime = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
const statusClass = value => value.toLowerCase().replaceAll(' ', '-');

export default function AdminKanban() {
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [statuses, setStatuses] = useState(defaultStatuses);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [technician, setTechnician] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api.get('/admin/jobs', { params: { search, status, priority, technician, dateFrom, dateTo, serviceType }, signal: controller.signal })
        .then(({ data }) => { setJobs(data.jobs); setTechnicians(data.technicians); setStatuses(data.statuses || defaultStatuses); setError(''); })
        .catch(requestError => { if (!controller.signal.aborted) setError(requestError.response?.data?.message || 'Unable to load workshop jobs.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, search ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, status, priority, technician, dateFrom, dateTo, serviceType, refreshVersion]);

  const clearFilters = () => { setSearch(''); setStatus(''); setPriority(''); setTechnician(''); setDateFrom(''); setDateTo(''); setServiceType(''); };
  return <div className="kanban-container">
    <header className="kanban-header"><div><h1 className="page-title">Workshop Job Board</h1><p className="page-subtitle">Live service jobs across the workshop workflow.</p></div><button type="button" className="kanban-refresh" onClick={() => setRefreshVersion(value => value + 1)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button></header>
    <section className="kanban-filters" aria-label="Filter workshop jobs">
      <label>Search<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Service number or vehicle registration…" /></label>
      <label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Technician<select value={technician} onChange={event => setTechnician(event.target.value)}><option value="">All technicians</option><option value="unassigned">Unassigned</option>{technicians.map(person => <option key={person.id} value={person.id}>{person.name} · {person.availabilityStatus}</option>)}</select></label>
      <label>Priority<select value={priority} onChange={event => setPriority(event.target.value)}><option value="">All priorities</option>{priorities.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Service type<input type="search" value={serviceType} onChange={event => setServiceType(event.target.value)} placeholder="Filter service type…" /></label>
      <label>Created from<input type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} /></label>
      <label>Created to<input type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} /></label>
      <button type="button" className="kanban-clear-filters" onClick={clearFilters}>Clear filters</button>
    </section>
    {error && <p className="kanban-error" role="alert">{error}</p>}
    <p className="kanban-result-count" role="status">{loading ? 'Updating board…' : `${jobs.length} job${jobs.length === 1 ? '' : 's'} found`}</p>
    <section className="kanban-board" aria-label="Workshop job workflow" aria-busy={loading}>
      {statuses.map(column => {
        const items = jobs.filter(job => job.status === column);
        return <section key={column} className={`kanban-column stage-${statusClass(column)}`} aria-label={`${column} jobs`}><header className="column-header"><h2>{column}</h2><span className="column-count">{items.length}</span></header>
          <div className="column-body">{items.length ? items.map(job => <article key={job.id} className="kanban-card"><div className="card-top"><span className="job-id">{job.serviceNumber}</span><span className={`priority-pill ${job.priority.toLowerCase()}`}>{job.priority}</span></div><h3 className="job-vehicle">{job.vehicle}</h3><div className="job-details"><span className="reg-number">{job.registrationNumber}</span><span>{job.serviceType}</span></div>{job.customerComplaint && <p className="job-complaint">{job.customerComplaint}</p>}<div className="card-bottom"><div className="tech-avatar">{job.technician === 'Unassigned' ? '?' : job.technician.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div><span className="tech-details"><strong>{job.technician}</strong>{job.specialization && <small>{job.specialization}</small>}</span></div><footer className="job-card-footer"><span>Created {dateTime(job.createdAt)}</span>{job.expectedCompletionTime && <span>Due {dateTime(job.expectedCompletionTime)}</span>}</footer></article>) : <p className="kanban-empty">No jobs in this stage.</p>}</div>
        </section>;
      })}
    </section>
  </div>;
}
