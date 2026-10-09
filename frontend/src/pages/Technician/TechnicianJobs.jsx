// Load assigned service jobs and link each job to its editable detail view.
import { serviceStatus } from '../../lib/serviceStatus';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Not scheduled';
const vehicleName = (vehicle) =>
  vehicle
    ? `${vehicle.year ? `${vehicle.year} ` : ''}${vehicle.make} ${vehicle.model}${vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ''}`
    : 'Vehicle details unavailable';

export default function TechnicianJobs() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const [startingAppointmentId, setStartingAppointmentId] = useState('');
  const [startError, setStartError] = useState('');

  // Load server data when these effect dependencies change; cleanup below prevents stale work from updating this view.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        api
          .get('/auth/technician/jobs', {
            params: { search, status, priority, sort, page, limit: 20 },
            signal: controller.signal,
          })
          .then(({ data }) => {
            if (!controller.signal.aborted)
              setResult({ key: `${search}|${status}|${priority}|${sort}|${page}`, data });
          })
          .catch((error) => {
            if (!controller.signal.aborted)
              setResult({
                key: `${search}|${status}|${priority}|${sort}|${page}`,
                error: error.response?.data?.message || 'Unable to load your assigned jobs.',
              });
          }),
      200,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, status, priority, sort, page, retry]);

  useEffect(() => {
    const refresh = () => setRetry((value) => value + 1);
    const interval = window.setInterval(refresh, 20000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const key = `${search}|${status}|${priority}|${sort}|${page}`;
  const current = result?.key === key ? result : null;
  function resetPage(setter, value) {
    setter(value);
    setPage(1);
  }

  async function startAppointment(appointmentId) {
    setStartingAppointmentId(appointmentId);
    setStartError('');
    try {
      // Send the submitted data to the server; the response below determines the success message and local state changes.
      const { data } = await api.post(`/auth/technician/appointments/${appointmentId}/start`);
      navigate(`/technician/jobs/${data.id}`);
    } catch (error) {
      setStartError(error.response?.data?.message || 'Unable to start this appointment workflow.');
      setRetry((value) => value + 1);
    } finally {
      setStartingAppointmentId('');
    }
  }

  return (
    <main className="technician-jobs-page">
      <header className="technician-jobs-heading">
        <div>
          <p className="technician-jobs-eyebrow">TECHNICIAN WORKSPACE</p>
          <h1 className="page-title">My Jobs</h1>
          <p className="page-subtitle">Search and organize the service jobs assigned to you.</p>
        </div>
        <Link className="technician-history-link" to="/technician/history">
          Completed history
        </Link>
        <button
          className="technician-history-link"
          type="button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Refresh jobs
        </button>
        <span className="technician-jobs-total">
          {current?.data ? `${current.data.total} jobs` : ' '}
        </span>
      </header>
      <section
        className="section-card technician-jobs-controls"
        aria-label="Search and filter jobs"
      >
        <label className="technician-jobs-search">
          Search jobs
          <input
            type="search"
            value={search}
            maxLength={100}
            placeholder="Service number, vehicle registration, or complaint"
            onChange={(event) => resetPage(setSearch, event.target.value)}
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => resetPage(setStatus, event.target.value)}>
            <option value="">All statuses</option>
            {['In Progress', 'Ready'].map(
              (value) => (
                <option key={value} value={value}>{serviceStatus(value)}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={(event) => resetPage(setPriority, event.target.value)}>
            <option value="">All priorities</option>
            {['Urgent', 'High', 'Normal', 'Low'].map((value) => (
              <option key={value} value={value}>{serviceStatus(value)}</option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(event) => resetPage(setSort, event.target.value)}>
            <option value="recent">Recently updated</option>
            <option value="oldest">Oldest first</option>
            <option value="dueSoon">Due date</option>
            <option value="priority">Priority</option>
          </select>
        </label>
      </section>
      {current?.data && (
        <section
          className="section-card technician-assigned-appointments"
          aria-label="Assigned appointments"
        >
          {startError && (
            <div className="technician-jobs-error" role="alert">
              {startError}
            </div>
          )}
          <header className="section-header">
            <h2>Assigned appointments</h2>
            <span>{current.data.appointments.length} scheduled</span>
          </header>
          {current.data.appointments.length ? (
            <div className="technician-appointment-list">
              {current.data.appointments.map((appointment) => (
                <article className="technician-appointment-item" key={appointment.id}>
                  <div>
                    <strong>{appointment.appointmentNumber}</strong>
                    <span>{vehicleName(appointment.vehicle)}</span>
                    <small>
                      {appointment.customer} · {appointment.serviceType}
                    </small>
                    {appointment.complaint && <small>{appointment.complaint}</small>}
                  </div>
                  <div className="technician-appointment-meta">
                    <span>
                      {dateTime(appointment.preferredDate)} · {appointment.preferredTime}
                    </span>
                    <span className="badge badge-warning">{serviceStatus(appointment.status)}</span>
                    {appointment.jobId && (
                      <Link to={`/technician/jobs/${appointment.jobId}`}>Open service job →</Link>
                    )}
                    {!appointment.jobId &&
                      ['Confirmed', 'Checked In', 'In Service'].includes(appointment.status) && (
                        <button
                          type="button"
                          disabled={Boolean(startingAppointmentId)}
                          onClick={() => startAppointment(appointment.id)}
                        >
                          {startingAppointmentId === appointment.id
                            ? 'Starting…'
                            : 'Start service'}
                        </button>
                      )}
                    {!appointment.jobId && appointment.status === 'Pending' && (
                      <small>Available after the workshop confirms this appointment.</small>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="technician-jobs-empty-copy">
              No active appointments are assigned to you.
            </p>
          )}
        </section>
      )}
      {current?.error && (
        <div className="technician-jobs-error" role="alert">
          <span>{current.error}</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {!current && (
        <div className="technician-jobs-loading" role="status">
          Loading your jobs…
        </div>
      )}
      {current?.data &&
        (current.data.jobs.length ? (
          <section className="technician-jobs-list" aria-label="Assigned jobs">
            {current.data.jobs.map((job) => (
              <article className="section-card technician-job-card" key={job.id}>
                <div className="technician-job-card-top">
                  <Link to={`/technician/jobs/${job.id}`} className="technician-job-number">
                    {job.serviceNumber}
                  </Link>
                  <span className="badge badge-warning">{serviceStatus(job.status)}</span>
                  <span className={`technician-priority ${job.priority.toLowerCase()}`}>
                    {job.priority}
                  </span>
                </div>
                <h2>{vehicleName(job.vehicle)}</h2>
                <p className="technician-job-meta">
                  {job.customer} · {job.serviceType}
                </p>
                {job.complaint && <p className="technician-job-complaint">{job.complaint}</p>}
                <footer>
                  <span>
                    {job.expectedCompletionTime
                      ? `Expected ${dateTime(job.expectedCompletionTime)}`
                      : 'Expected completion not set'}
                  </span>
                  <Link to={`/technician/jobs/${job.id}`}>
                    Open job <span aria-hidden="true">→</span>
                  </Link>
                </footer>
              </article>
            ))}
          </section>
        ) : (
          <section className="section-card technician-jobs-empty">
            <h2>No matching jobs</h2>
            <p>Try changing your search or filters. Jobs assigned to you will appear here.</p>
          </section>
        ))}
      {current?.data?.pages > 1 && (
        <nav className="technician-jobs-pagination" aria-label="Job list pages">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>
            Page {current.data.page} of {current.data.pages}
          </span>
          <button
            type="button"
            disabled={page >= current.data.pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </main>
  );
}
