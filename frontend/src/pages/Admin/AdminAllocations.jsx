import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
const dateText = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Not recorded';

export default function AdminAllocations() {
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [search, setSearch] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(
      () =>
        api
          .get('/admin/allocations', { params: search ? { search } : {} })
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
  }, [search, refreshVersion]);

  async function assign(job, technicianId) {
    setSavingId(job.id);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch(`/admin/jobs/${job.id}/technician`, { technicianId });
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
          : `${job.reference} ${data.action.toLowerCase()} successfully.`,
      );
      const { data: refreshed } = await api.get('/admin/allocations', {
        params: search ? { search } : {},
      });
      setTechnicians(refreshed.technicians);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to change this assignment.');
    } finally {
      setSavingId('');
    }
  }

  const visibleJobs = jobs.filter((job) => !unassignedOnly || !job.technicianId);
  const availableTechnicians = technicians.filter(
    (person) => person.availabilityStatus === 'Available',
  );

  return (
    <div className="admin-allocations-page">
      <header className="admin-allocations-heading">
        <div>
          <h1 className="page-title">Technician Allocation</h1>
          <p className="page-subtitle">
            Assign open jobs to available technicians and review today’s workload.
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
          <h2>Available technicians</h2>
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
                    {person.activeJobs} active job{person.activeJobs === 1 ? '' : 's'}
                  </span>
                  <strong>
                    {person.assignedToday} assignment{person.assignedToday === 1 ? '' : 's'} today
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
            <h2>Open service jobs</h2>
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
                placeholder="Service number or registration…"
              />
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
        {loading ? (
          <p role="status">Loading allocation data…</p>
        ) : visibleJobs.length ? (
          <div className="allocation-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job / vehicle</th>
                  <th>Service</th>
                  <th>Stage / priority</th>
                  <th>Assigned technician</th>
                  <th>Assignment time</th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <strong>{job.reference}</strong>
                      <small>
                        {job.vehicle} · {job.registrationNumber}
                      </small>
                    </td>
                    <td>{job.serviceType}</td>
                    <td>
                      {job.status}
                      <small className={`allocation-priority ${job.priority.toLowerCase()}`}>
                        {job.priority} priority
                      </small>
                    </td>
                    <td>
                      <select
                        aria-label={`Assign ${job.reference}`}
                        value={job.technicianId}
                        disabled={savingId === job.id}
                        onChange={(event) => assign(job, event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {technicians.map((person) => (
                          <option
                            key={person.id}
                            value={person.id}
                            disabled={
                              person.availabilityStatus !== 'Available' &&
                              person.id !== job.technicianId
                            }
                          >
                            {person.name} · {person.availabilityStatus} · {person.activeJobs} active
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{job.technicianId ? dateText(job.assignedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No open service jobs match these filters.</p>
        )}
      </section>
    </div>
  );
}
