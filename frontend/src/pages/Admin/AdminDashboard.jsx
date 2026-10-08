import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import Icon from '../../components/Icon';
const money = (amount) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(amount || 0);
const dateTime = (date, time) => {
  const parsed = new Date(date);
  const dateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsed);
  return `${dateLabel}${time ? ` · ${time}` : ''}`;
};
const statusClass = (status) => status.toLowerCase().replaceAll(' ', '-');

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/dashboard');
      setDashboard(data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Unable to load workshop information. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading && !dashboard) return <p role="status">Loading workshop dashboard…</p>;
  if (error && !dashboard)
    return (
      <div className="admin-dashboard-error" role="alert">
        <p>{error}</p>
        <button className="btn-primary" onClick={loadDashboard}>
          Try again
        </button>
      </div>
    );

  const { summary, appointments, activeJobs, technicians, jobsAwaitingApproval, recentActivity } =
    dashboard;
  const cards = [
    ['Today’s appointments', summary.todayAppointments, 'blue'],
    ['Pending appointments', summary.pendingAppointments, 'amber'],
    ['Upcoming appointments', summary.upcomingAppointments, 'violet'],
    ['Active workshop jobs', summary.activeJobs, 'green'],
    ['Vehicles in workshop', summary.vehiclesInWorkshop, 'red'],
    [
      'Technician availability',
      `${summary.techniciansAvailable} available · ${summary.techniciansBusy} unavailable`,
      'cyan',
    ],
    ['Daily revenue received', money(summary.dailyRevenue), 'green'],
  ];

  return (
    <div className="dashboard-container admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Workshop Overview</h1>
          <p className="page-subtitle">
            Live appointments, service jobs, vehicles, and technician availability.
          </p>
        </div>
        <button className="admin-dashboard-refresh" onClick={loadDashboard} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {error && (
        <p className="admin-dashboard-inline-error" role="alert">
          {error}
        </p>
      )}

      <section className="admin-dashboard-cards" aria-label="Workshop key metrics">
        {cards.map(([label, value, color]) => (
          <article className="admin-metric-card" key={label}>
            <span className={`admin-metric-dot ${color}`} aria-hidden="true" />
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="admin-stage-summary" aria-label="Workshop job stages">
        <h2>Job stages</h2>
        {['Inspecting', 'In Progress', 'Final Test', 'Ready'].map((stage, index) => {
          const value = [summary.inspecting, summary.inProgress, summary.finalTest, summary.ready][
            index
          ];
          return (
            <div className="admin-stage" key={stage}>
              <span className={`admin-stage-marker stage-${index}`} />
              <span>{stage}</span>
              <strong>{value}</strong>
            </div>
          );
        })}
      </section>

      <div className="admin-dashboard-columns">
        <section className="section-card">
          <div className="section-header">
            <h2>Today & upcoming appointments</h2>
            <span>{appointments.length} shown</span>
          </div>
          {appointments.length ? (
            <div className="admin-table-wrap">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Appointment</th>
                    <th>Customer / vehicle</th>
                    <th>Service</th>
                    <th>When</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((item) => (
                    <tr key={item.id}>
                      <td>{item.reference}</td>
                      <td>
                        <strong>{item.customer}</strong>
                        <small>
                          {item.vehicle} · {item.registrationNumber}
                        </small>
                      </td>
                      <td>{item.serviceType}</td>
                      <td>{dateTime(item.preferredDate, item.preferredTime)}</td>
                      <td>
                        <span className={`admin-status ${statusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dashboard-empty">No upcoming appointments are scheduled.</p>
          )}
        </section>

        <section className="section-card">
          <div className="section-header">
            <h2>Technician availability</h2>
            <span>{technicians.length} technicians</span>
          </div>
          {technicians.length ? (
            <ul className="admin-technician-list">
              {technicians.map((technician) => (
                <li key={technician.id}>
                  <span>
                    <strong>{technician.name}</strong>
                    <small>{technician.email}</small>
                  </span>
                  <span className={`admin-status ${statusClass(technician.status)}`}>
                    {technician.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">No active technicians are registered.</p>
          )}
        </section>

        <section className="section-card">
          <div className="section-header">
            <h2>Active workshop jobs</h2>
            <span>{summary.activeJobs} total</span>
          </div>
          {activeJobs.length ? (
            <div className="admin-job-list">
              {activeJobs.map((job) => (
                <article className="admin-job-row" key={job.id}>
                  <div>
                    <strong>
                      {job.reference} · {job.vehicle}
                    </strong>
                    <small>
                      {job.registrationNumber} · {job.customer}
                    </small>
                  </div>
                  <div>
                    <span className={`admin-status ${statusClass(job.status)}`}>{job.status}</span>
                    <small>Tech: {job.technician}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">No active workshop jobs.</p>
          )}
        </section>

        <section className="section-card">
          <div className="section-header">
            <h2>Jobs awaiting approval</h2>
            <span>{jobsAwaitingApproval.length} shown</span>
          </div>
          {jobsAwaitingApproval.length ? (
            <div className="admin-job-list">
              {jobsAwaitingApproval.map((job) => (
                <article className="admin-job-row" key={job.id}>
                  <div>
                    <strong>
                      {job.reference} · {job.vehicle}
                    </strong>
                    <small>{job.customer}</small>
                  </div>
                  <span className="admin-status waiting-for-approval">
                    {job.pendingRepairs
                      ? `${job.pendingRepairs} repair request${job.pendingRepairs === 1 ? '' : 's'}`
                      : 'Awaiting approval'}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">No jobs are waiting for approval.</p>
          )}
        </section>

        <section className="section-card admin-activity-card">
          <div className="section-header">
            <h2>Recent workshop activity</h2>
          </div>
          {recentActivity.length ? (
            <ul className="admin-activity-list">
              {recentActivity.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <span className="admin-activity-icon">
                    <Icon name={item.kind === 'job' ? 'wrench' : 'calendar'} />
                  </span>
                  <span>
                    <strong>
                      {item.reference} · {item.vehicle}
                    </strong>
                    <small>
                      {item.kind === 'job' ? 'Job' : 'Appointment'} updated to {item.status}
                    </small>
                  </span>
                  <time dateTime={item.updatedAt}>
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(item.updatedAt))}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dashboard-empty">No workshop activity has been recorded.</p>
          )}
        </section>
      </div>
    </div>
  );
}
