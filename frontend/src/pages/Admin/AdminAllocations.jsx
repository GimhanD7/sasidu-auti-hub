// Display active jobs and technician workloads; assignment changes are sent to the server and reflected in the allocation view.
import { serviceStatus } from '../../lib/serviceStatus';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
const dateText = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Not recorded';
const jobStage = (job) => job.recordType === 'appointment' ? 'Pending' : serviceStatus(job.status);
const dayText = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';

export default function AdminAllocations() {
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [search, setSearch] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Load server data when these effect dependencies change; cleanup below prevents stale work from updating this view.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () =>
        api
          .get('/admin/allocations', { params: { ...(search ? { search } : {}), ...(technicianFilter ? { technician: technicianFilter } : {}) } })
          .then(({ data }) => {
            if (!cancelled) {
              setJobs(data.jobs);
              setTechnicians(data.technicians);
              setError('');
            }
          })
          .catch((requestError) => {
            if (!cancelled)
              setError(requestError.response?.data?.message || 'Unable to load allocation data.');
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          }),
      search ? 250 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, technicianFilter, refreshVersion]);

  useEffect(() => {
    const refresh = () => setRefreshVersion(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  async function assign(job, technicianId) {
    setSavingId(job.id);
    setError('');
    setNotice('');
    try {
      // Request a server-side change; update the displayed state from the successful response below.
      const { data } = job.recordType === 'appointment'
        ? await api.patch(`/admin/appointments/${job.id}`, { technicianId })
        : await api.patch(`/admin/jobs/${job.id}/technician`, { technicianId });
      setJobs((current) =>
        current.map((item) =>
          item.id === job.id
            ? {
                ...item,
                technicianId: data.technicianId,
                technician: data.technician,
                assignedAt: data.assignedAt,
              }
            : item,
        ),
      );
      setNotice(
        data.action === 'Removed'
          ? `${job.reference} is now unassigned.`
          : data.action
            ? `${job.reference} ${data.action.toLowerCase()} successfully.`
            : data.message || `${job.reference} assignment is up to date.`,
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to change this assignment.');
      setSavingId('');
      return;
    }

    try {
      const { data: refreshed } = await api.get('/admin/allocations', {
        params: { ...(search ? { search } : {}), ...(technicianFilter ? { technician: technicianFilter } : {}) },
      });
      setJobs(refreshed.jobs);
      setTechnicians(refreshed.technicians);
    } catch {
      setError(
        'Assignment saved, but workload totals could not refresh. Use Refresh to reload them.',
      );
    } finally {
      setSavingId('');
    }
  }

  const visibleJobs = jobs.filter((job) => (!unassignedOnly || !job.technicianId) && (!statusFilter || jobStage(job) === statusFilter));
  const availableTechnicians = technicians.filter(
    (person) => person.availabilityStatus === 'Available' && person.activeJobs === 0,
  );

  return (
    <div className="admin-allocations-page">
      <header className="admin-allocations-heading">
        <div>
          <h1 className="page-title">Technician Allocation</h1>
          <p className="page-subtitle">
            Review pending, in-progress and completed work and assign available technicians.
          </p>
        </div>
        <button
          className="allocation-refresh"
          onClick={() => setRefreshVersion((value) => value + 1)}
          disabled={loading}
        >
          Refresh
        </button>
      </header>
      {notice && (
        <p className="allocation-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="allocation-error" role="alert">
          {error}
        </p>
      )}
      <section className="allocation-capacity section-card">
        <header>
          <h2>Technician workload & availability</h2>
          <span>
            {availableTechnicians.length} available ·{' '}
            {technicians.length - availableTechnicians.length} unavailable
          </span>
        </header>
        {technicians.length ? (
          <div className="allocation-tech-grid">
            {technicians.map((person) => (
              <article
                key={person.id}
                className={person.availabilityStatus === 'Available' ? '' : 'unavailable'}
              >
                <div>
                  <strong>{person.name}</strong>
                  <span
                    className={`allocation-status ${person.availabilityStatus.toLowerCase().replaceAll(' ', '-')}`}
                  >
                    {person.availabilityStatus}
                  </span>
                </div>
                <p>{person.specialization}</p>
                <footer>
                  <span>
                    {person.pendingAppointments || 0} waiting to start · {person.activeJobs} in progress
                  </span>
                  <strong>
                    {person.assignedToday} service assignment{person.assignedToday === 1 ? '' : 's'} today
                  </strong>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <p>No technicians are registered.</p>
        )}
      </section>
      <section className="allocation-jobs section-card">
        <header>
          <div>
            <h2>Appointments & service jobs</h2>
            <span>
              {visibleJobs.length} shown · {jobs.filter((job) => !job.technicianId).length}{' '}
              unassigned
            </span>
          </div>
          <div className="allocation-filters">
            <label>
              Search
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Reference, customer, technician or vehicle number…"
              />
            </label>
            <label>
              Technician
              <select value={technicianFilter} onChange={event => setTechnicianFilter(event.target.value)}>
                <option value="">All technicians</option>
                {technicians.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <label>
              Status
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {['Pending', 'In Progress', 'Completed'].map(status => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className="allocation-unassigned-filter">
              <input
                type="checkbox"
                checked={unassignedOnly}
                onChange={(event) => setUnassignedOnly(event.target.checked)}
              />
              Unassigned only
            </label>
          </div>
        </header>
        {(search || technicianFilter || statusFilter || unassignedOnly) && <button type="button" className="btn-outline" onClick={() => { setSearch(''); setTechnicianFilter(''); setStatusFilter(''); setUnassignedOnly(false); }}>Clear filters</button>}
        <p className="section-help-text">Pending includes confirmed bookings waiting for the technician to start service.</p>
        {loading ? (
          <p role="status">Loading allocation data…</p>
        ) : visibleJobs.length ? (
          <div className="admin-data-table-wrap">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Vehicle number</th>
                  <th>Service</th>
                  <th>Assigned technician</th>
                  <th>Availability</th>
                  <th>Status</th>
                  <th>Assignment time</th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((job) => (
                  <tr key={`${job.recordType}-${job.id}`}>
                    <td>{dayText(job.preferredDate)}</td>
                    <td>{job.preferredTime || (job.createdAt ? new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(job.createdAt)) : '—')}</td>
                    <td>
                      <strong>{job.reference}</strong>
                    </td>
                    <td>{job.customer}</td>
                    <td>{job.vehicle}</td>
                    <td>{job.registrationNumber || '—'}</td>
                    <td>{job.serviceType}</td>
                    <td>
                      {job.canAssign ? (
                      <select
                        aria-label={`Assign ${job.reference}`}
                        value={job.technicianId}
                        disabled={savingId === job.id}
                        onChange={(event) => assign(job, event.target.value)}
                      >
                        <option value="" disabled={job.recordType === 'appointment' && job.status !== 'Pending'}>Unassigned</option>
                        {technicians.map((person) => (
                          <option
                            key={person.id}
                            value={person.id}
                            disabled={
                              (person.availabilityStatus !== 'Available' || person.activeJobs > 0) &&
                              person.id !== job.technicianId
                            }
                          >
                            {person.name} · {person.availabilityStatus} · {person.activeJobs} active
                          </option>
                        ))}
                      </select>
                      ) : (job.technician || 'Unassigned')}
                      {job.recordType === 'appointment' && job.status === 'Pending' && <small>Assign a technician to confirm this booking.</small>}
                    </td>
                    <td>{job.technicianId ? technicians.find(person => person.id === job.technicianId)?.availabilityStatus || job.availabilityStatus || 'Unavailable' : '—'}</td>
                    <td><strong>{jobStage(job)}</strong>
                      {job.recordType === 'appointment' && <small>{serviceStatus(job.status)}</small>}
                      <small className={`allocation-priority ${job.priority.toLowerCase()}`}>{job.priority} priority</small>
                    </td>
                    <td>{job.technicianId ? dateText(job.assignedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No appointments or service jobs match these filters.</p>
        )}
      </section>
    </div>
  );
}
