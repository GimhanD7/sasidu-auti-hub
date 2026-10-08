import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import '../Customer/CustomerDashboard.css';
import './TechnicianJobs.css';

const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Completion date unavailable';
const vehicleName = (vehicle) =>
  vehicle
    ? `${vehicle.year ? `${vehicle.year} ` : ''}${vehicle.make} ${vehicle.model}${vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ''}`
    : 'Vehicle details unavailable';

export default function TechnicianJobHistory() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const key = `${search}|${page}`;
    const timer = window.setTimeout(
      () =>
        api
          .get('/auth/technician/jobs/history', {
            params: { search, page, limit: 20 },
            signal: controller.signal,
          })
          .then(({ data }) => {
            if (!controller.signal.aborted) setResult({ key, data });
          })
          .catch((error) => {
            if (!controller.signal.aborted)
              setResult({
                key,
                error: error.response?.data?.message || 'Unable to load completed job history.',
              });
          }),
      200,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, page, retry]);
  const key = `${search}|${page}`;
  const current = result?.key === key ? result : null;

  return (
    <main className="technician-jobs-page">
      <Link className="technician-back-link" to="/technician/jobs">
        ← Back to My Jobs
      </Link>
      <header className="technician-jobs-heading">
        <div>
          <p className="technician-jobs-eyebrow">TECHNICIAN WORKSPACE</p>
          <h1 className="page-title">Completed Job History</h1>
          <p className="page-subtitle">
            Review completed job cards, diagnosis, repair tasks, parts, and labour.
          </p>
        </div>
        <span className="technician-jobs-total">
          {current?.data ? `${current.data.total} completed` : ''}
        </span>
      </header>
      <section className="section-card technician-history-controls">
        <label>
          Search completed jobs
          <input
            type="search"
            value={search}
            maxLength={100}
            placeholder="Service number, vehicle registration, or complaint"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </section>
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
          Loading completed jobs…
        </div>
      )}
      {current?.data &&
        (current.data.jobs.length ? (
          <section className="technician-jobs-list" aria-label="Completed jobs">
            {current.data.jobs.map((job) => (
              <article className="section-card technician-job-card" key={job.id}>
                <div className="technician-job-card-top">
                  <Link to={`/technician/jobs/${job.id}`} className="technician-job-number">
                    {job.serviceNumber}
                  </Link>
                  <span className="technician-completed-badge">Ready</span>
                  <span>Completed {dateTime(job.completedAt)}</span>
                </div>
                <h2>{vehicleName(job.vehicle)}</h2>
                <p className="technician-job-meta">
                  {job.customer} · {job.serviceType}
                </p>
                {job.complaint && <p className="technician-job-complaint">{job.complaint}</p>}
                <footer>
                  <span>Job card includes diagnosis, tasks, used parts, and labour entries</span>
                  <Link to={`/technician/jobs/${job.id}`}>
                    View job card <span aria-hidden="true">→</span>
                  </Link>
                </footer>
              </article>
            ))}
          </section>
        ) : (
          <section className="section-card technician-jobs-empty">
            <h2>No completed jobs found</h2>
            <p>
              Completed jobs assigned to you will appear here. Try another service number or vehicle
              registration.
            </p>
          </section>
        ))}
      {current?.data?.pages > 1 && (
        <nav className="technician-jobs-pagination" aria-label="Completed job history pages">
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
