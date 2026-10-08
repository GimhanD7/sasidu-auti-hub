import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../auth/useAuth';
const number = (value) => new Intl.NumberFormat().format(value ?? 0);
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

const indicators = [
  {
    key: 'assigned',
    label: 'Assigned',
    color: '#3b82f6',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  },
  {
    key: 'inProgress',
    label: 'In Progress',
    color: '#f59e0b',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    key: 'waitingForApproval',
    label: 'Waiting for Approval',
    color: '#a855f7',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    key: 'completedToday',
    label: 'Completed Today',
    color: '#10b981',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

function SummaryCard({ item, value }) {
  return (
    <article className="summary-card">
      <div
        className="card-icon"
        style={{ backgroundColor: `${item.color}1a`, color: item.color }}
        aria-hidden="true"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
        </svg>
      </div>
      <div className="card-info">
        <h3>{item.label}</h3>
        <p className="card-value">{number(value)}</p>
      </div>
    </article>
  );
}

function JobList({ jobs, empty, showPriority = false }) {
  if (!jobs?.length)
    return (
      <div className="dashboard-empty">
        <p>{empty}</p>
      </div>
    );
  return (
    <div className="technician-job-list">
      {jobs.map((job) => (
        <article className="technician-job-item" key={job.id}>
          <div className="technician-job-main">
            <div className="technician-job-heading">
              <Link to={`/technician/jobs/${job.id}`}>{job.serviceNumber}</Link>
              <span
                className={`badge ${job.status === 'Waiting for Approval' ? 'badge-warning' : 'technician-status-badge'}`}
              >
                {job.status}
              </span>
              {showPriority && (
                <span className={`technician-priority ${job.priority.toLowerCase()}`}>
                  {job.priority}
                </span>
              )}
            </div>
            <h3>{vehicleName(job.vehicle)}</h3>
            <p>
              {job.customer} · {job.serviceType}
            </p>
            {job.complaint && <p className="technician-complaint">{job.complaint}</p>}
            <small>
              {job.expectedCompletionTime
                ? `Due ${dateTime(job.expectedCompletionTime)}`
                : job.appointmentDate
                  ? `Appointment ${dateTime(job.appointmentDate)}${job.appointmentTime ? ` · ${job.appointmentTime}` : ''}`
                  : `Updated ${dateTime(job.updatedAt)}`}
            </small>
          </div>
        </article>
      ))}
    </div>
  );
}

function NotificationList({ notifications }) {
  if (!notifications?.length)
    return (
      <div className="dashboard-empty">
        <p>You’re all caught up. New job and approval updates will appear here.</p>
      </div>
    );
  return (
    <div className="notification-list">
      {notifications.map((item) => (
        <article className={`notification-item ${!item.isRead ? 'unread' : ''}`} key={item.id}>
          <span className="notif-icon" aria-hidden="true">
            {item.isRead ? '✓' : '🔔'}
          </span>
          <div className="notif-content">
            <p>
              <strong>{item.title}</strong>
            </p>
            <p>{item.message}</p>
            <span className="notif-time">{dateTime(item.createdAt)}</span>
            {item.link?.startsWith('/technician/') && <Link to={item.link}>View details</Link>}
          </div>
        </article>
      ))}
    </div>
  );
}

function DashboardContent({ data, fullName }) {
  const active = data.activeJob;
  return (
    <main className="dashboard-container technician-dashboard">
      <header className="dashboard-header">
        <div>
          <h1 className="page-title">
            Welcome back, {data.technician?.fullName || fullName || 'Technician'}!
          </h1>
          <p className="page-subtitle">Your workshop jobs and updates for today.</p>
        </div>
        <Link className="btn-primary dashboard-quick-link" to="/technician/jobs">
          View all jobs
        </Link>
      </header>
      <section className="summary-cards" aria-label="Job status indicators">
        {indicators.map((item) => (
          <SummaryCard key={item.key} item={item} value={data.summary?.[item.key]} />
        ))}
      </section>
      <div className="dashboard-grid">
        <div className="grid-col-2">
          <section className="section-card" aria-labelledby="active-job-heading">
            <div className="section-header">
              <h2 id="active-job-heading">Current Active Job</h2>
              {active && <span className="badge badge-warning">IN PROGRESS</span>}
            </div>
            {active ? (
              <JobList jobs={[active]} empty="No active job right now." showPriority />
            ) : (
              <div className="dashboard-empty">
                <h3>No job in progress</h3>
                <p>When you start an assigned job, it will appear here.</p>
              </div>
            )}
          </section>
          <section className="section-card" aria-labelledby="today-jobs-heading">
            <div className="section-header">
              <h2 id="today-jobs-heading">Today’s Jobs</h2>
              <span>{number(data.summary?.today)} scheduled</span>
            </div>
            <JobList
              jobs={data.todayJobs}
              empty="You have no assigned jobs scheduled for today."
              showPriority
            />
          </section>
          <section className="section-card" aria-labelledby="pending-jobs-heading">
            <div className="section-header">
              <h2 id="pending-jobs-heading">Pending Jobs</h2>
              <span>{number(data.summary?.assigned)} assigned</span>
            </div>
            <JobList
              jobs={data.pendingJobs}
              empty="No jobs are waiting to be started."
              showPriority
            />
          </section>
          <section className="section-card" aria-labelledby="assigned-jobs-heading">
            <div className="section-header">
              <h2 id="assigned-jobs-heading">Assigned Jobs</h2>
              <Link to="/technician/jobs">Open My Jobs</Link>
            </div>
            <JobList
              jobs={data.assignedJobs}
              empty="No active jobs are assigned to you."
              showPriority
            />
          </section>
          <section className="section-card" aria-labelledby="completed-jobs-heading">
            <div className="section-header">
              <h2 id="completed-jobs-heading">Completed Jobs</h2>
              <Link to="/technician/history">
                View history · {number(data.summary?.completed)} total
              </Link>
            </div>
            <JobList jobs={data.completedJobs} empty="Completed jobs will appear here." />
          </section>
          <section className="section-card" aria-labelledby="priority-jobs-heading">
            <div className="section-header">
              <h2 id="priority-jobs-heading">High-Priority Jobs</h2>
              <span>{number(data.summary?.highPriority)} active</span>
            </div>
            <JobList
              jobs={data.highPriorityJobs}
              empty="No high-priority active jobs."
              showPriority
            />
          </section>
        </div>
        <aside className="grid-col-1">
          <section className="section-card" aria-labelledby="technician-notifications-heading">
            <div className="section-header">
              <h2 id="technician-notifications-heading">Notifications</h2>
              <span>{number(data.unreadNotifications)} unread</span>
            </div>
            <NotificationList notifications={data.notifications} />
          </section>
        </aside>
      </div>
    </main>
  );
}

export default function TechnicianDashboard() {
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/auth/technician-dashboard', { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setResult({ userId: user?._id, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            userId: user?._id,
            error:
              error.response?.data?.message ||
              'Unable to load your technician dashboard. Check your connection and try again.',
          });
      });
    return () => controller.abort();
  }, [user?._id, retry]);
  const current = result?.userId === user?._id ? result : null;
  if (current?.error)
    return (
      <div className="dashboard-container" role="alert">
        <h1 className="page-title">Your dashboard couldn’t load</h1>
        <p>{current.error}</p>
        <button
          className="btn-primary"
          type="button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Try again
        </button>
      </div>
    );
  if (!current?.data)
    return (
      <div className="dashboard-container" role="status" aria-live="polite">
        <h1 className="page-title">Loading your dashboard…</h1>
        <p className="page-subtitle">Getting your assigned jobs and latest updates.</p>
      </div>
    );
  return <DashboardContent data={current.data} fullName={user?.fullName} />;
}
