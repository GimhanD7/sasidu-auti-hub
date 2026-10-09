// Load the customer overview and display upcoming appointments, vehicle service progress, and account summaries.
import { serviceStatus } from '../../lib/serviceStatus';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import Icon from '../../components/Icon';
import { useAuth } from '../../auth/useAuth';
const WORKFLOW = ['In Progress', 'Completed'];
const number = (value) => new Intl.NumberFormat().format(value ?? 0);
const vehicleLabel = (vehicle) =>
  vehicle
    ? `${vehicle.make} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}${vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ''}`
    : 'Vehicle details unavailable';
const formatDate = (value) => {
  const day = typeof value === 'string' ? value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] : null;
  const date = day ? new Date(`${day}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
};
const appointmentDateTime = (date, time) => `${formatDate(date)}${time ? ` · ${time}` : ''}`;

function SummaryCard({ label, value, icon, color }) {
  return (
    <article className="summary-card">
      <div
        className="card-icon"
        style={{ backgroundColor: `${color}1a`, color }}
        aria-hidden="true"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
        </svg>
      </div>
      <div className="card-info">
        <h3>{label}</h3>
        <p className="card-value">{number(value)}</p>
      </div>
    </article>
  );
}

function RepairProgress({ status }) {
  const index =
    WORKFLOW.indexOf(serviceStatus(status));
  return (
    <div className="repair-progress" aria-label={`Repair status: ${status}`}>
      {WORKFLOW.map((step, stepIndex) => (
        <div
          className={`progress-step ${stepIndex < index ? 'completed' : ''} ${stepIndex === index ? 'active' : ''}`}
          key={step}
        >
          <div className="step-circle" aria-hidden="true">
            {stepIndex < index ? '✓' : stepIndex + 1}
          </div>
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

function DashboardContent({ data }) {
  const { customer, summary } = data;
  const unreadCount = (data.unreadNotifications || 0) + (data.unreadMessages || 0);
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Welcome back, {customer.fullName}!</h1>
          <p className="page-subtitle">Your vehicles and service at a glance.</p>
          <p className="customer-profile-summary">
            {customer.email}
            {customer.mobile ? ` · ${customer.mobile}` : ''}
          </p>
        </div>
        <Link className="btn-primary dashboard-quick-link" to="/customer/appointments">
          + Book Appointment
        </Link>
      </div>

      <div className="summary-cards" aria-label="Account summary">
        <SummaryCard
          label="Registered Vehicles"
          value={summary.vehicles}
          color="#3b82f6"
          icon="M13 10V3L4 14h7v7l9-11h-7z"
        />
        <SummaryCard
          label="Active Repairs"
          value={summary.activeRepairs}
          color="#f59e0b"
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <SummaryCard
          label="Upcoming Appointments"
          value={summary.upcomingAppointments}
          color="#10b981"
          icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
        <SummaryCard
          label="Outstanding Invoices"
          value={summary.outstandingInvoices}
          color="#ef4444"
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a2 2 0 01.707.293l5.414 5.414a2 2 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </div>

      <div className="dashboard-grid">
        <div className="grid-col-2">
          <section className="section-card" aria-labelledby="active-repairs-heading">
            <div className="section-header">
              <h2 id="active-repairs-heading">Active Repairs</h2>
            </div>
            {data.activeJobs.length ? (
              <div className="dashboard-record-list">
                {data.activeJobs.map((job) => (
                  <article className="dashboard-record" key={job.id}>
                    <div className="section-header">
                      <div className="repair-vehicle">
                        <div className="vehicle-image" aria-hidden="true">
                          <Icon name="car" />
                        </div>
                        <div>
                          <h4>{vehicleLabel(job.vehicle)}</h4>
                          <p>Service job {String(job.id).slice(-6).toUpperCase()}</p>
                        </div>
                      </div>
                      <span className="badge badge-warning">{serviceStatus(job.status)}</span>
                    </div>
                    <RepairProgress status={serviceStatus(job.status)} />
                    <p className="repair-eta">
                      {job.expectedCompletionTime ? (
                        <>
                          <strong>Estimated completion:</strong>{' '}
                          {new Intl.DateTimeFormat(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(job.expectedCompletionTime))}
                        </>
                      ) : (
                        'Completion estimate not available yet.'
                      )}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">
                <h3>No active repairs</h3>
                <p>
                  Your active service jobs will appear here once your vehicle is in the workshop.
                </p>
                <Link to="/customer/appointments">Book a service appointment</Link>
              </div>
            )}
          </section>

          <section className="section-card" aria-labelledby="appointment-heading">
            <div className="section-header">
              <h2 id="appointment-heading">Upcoming Appointment</h2>
              <Link to="/customer/appointments">All appointments</Link>
            </div>
            {data.upcomingAppointment ? (
              <div className="dashboard-detail">
                <p>
                  <strong>{data.upcomingAppointment.serviceType}</strong>
                </p>
                <p>{vehicleLabel(data.upcomingAppointment.vehicle)}</p>
                <p>
                  {appointmentDateTime(
                    data.upcomingAppointment.preferredDate,
                    data.upcomingAppointment.preferredTime,
                  )}
                </p>
                <p>Status: {data.upcomingAppointment.status}</p>
                {data.upcomingAppointment.technician && (
                  <p>Technician: {data.upcomingAppointment.technician}</p>
                )}
              </div>
            ) : (
              <div className="dashboard-empty">
                <p>No upcoming appointments.</p>
                <Link to="/customer/appointments">Book an appointment</Link>
              </div>
            )}
          </section>

          <section className="section-card" aria-labelledby="invoice-heading">
            <div className="section-header">
              <h2 id="invoice-heading">Latest Invoice</h2>
              <Link to="/customer/invoices">All invoices</Link>
            </div>
            {data.latestInvoice ? (
              <div className="dashboard-detail">
                <p>
                  <strong>Invoice {data.latestInvoice.invoiceNumber}</strong>
                </p>
                <p>Amount: {number(data.latestInvoice.totalAmount)}</p>
                <p>Payment status: {data.latestInvoice.paymentStatus}</p>
                <p>Issued: {formatDate(data.latestInvoice.createdAt)}</p>
              </div>
            ) : (
              <div className="dashboard-empty">
                <p>You don't have an invoice yet.</p>
                <Link to="/customer/invoices">View invoices</Link>
              </div>
            )}
          </section>
        </div>

        <div className="grid-col-1">
          <section className="section-card" aria-labelledby="notifications-heading">
            <div className="section-header">
              <h2 id="notifications-heading">Notifications</h2>
              <span aria-label={`${unreadCount} unread`}>{number(unreadCount)} unread</span>
            </div>
            {data.notifications.length ? (
              <div className="notification-list">
                {data.notifications.map((item) => (
                  <article
                    className={`notification-item ${!item.isRead ? 'unread' : ''}`}
                    key={item.id}
                  >
                    <span className="notif-icon" aria-hidden="true">
                      {item.isRead ? '✓' : '🔔'}
                    </span>
                    <div className="notif-content">
                      <p>
                        <strong>{item.title}</strong>
                      </p>
                      <p>{item.message}</p>
                      <span className="notif-time">{formatDate(item.createdAt)}</span>
                      {item.link?.startsWith('/') && !item.link.startsWith('//') && (
                        <Link to={item.link}>View details</Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">
                <p>You’re all caught up. New notifications will appear here.</p>
              </div>
            )}
          </section>

          <section className="section-card" aria-labelledby="vehicles-heading">
            <div className="section-header">
              <h2 id="vehicles-heading">My Vehicles</h2>
              <Link to="/customer/vehicles">View vehicles</Link>
            </div>
            {data.vehicles.length ? (
              <ul className="dashboard-vehicle-list">
                {data.vehicles.map((vehicle) => (
                  <li key={vehicle.id}>
                    <Link to="/customer/vehicles">
                      <strong>{vehicleLabel(vehicle)}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="dashboard-empty">
                <p>Add a vehicle to start booking services.</p>
                <Link to="/customer/vehicles">Manage vehicles</Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);

  // Load server data when these effect dependencies change; cleanup below prevents stale work from updating this view.
  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/auth/customer-dashboard', { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setResult({ userId: user?._id, data: response.data });
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setResult({
            userId: user?._id,
            error:
              requestError.response?.data?.message ||
              'Unable to load your dashboard. Please check your connection and try again.',
          });
      });
    return () => controller.abort();
  }, [user?._id, retry]);

  const currentResult = result?.userId === user?._id ? result : null;
  if (currentResult?.error)
    return (
      <div className="dashboard-container" role="alert">
        <h1 className="page-title">Your dashboard couldn't load</h1>
        <p>{currentResult.error}</p>
        <button
          className="btn-primary"
          type="button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Try again
        </button>
      </div>
    );
  if (!currentResult?.data)
    return (
      <div className="dashboard-container" role="status" aria-live="polite">
        <h1 className="page-title">Loading your dashboard…</h1>
        <p className="page-subtitle">Getting your latest vehicle and service information.</p>
      </div>
    );
  return (
    <DashboardContent
      data={{
        ...currentResult.data,
        vehicles: currentResult.data.vehicles || [],
        activeJobs: currentResult.data.activeJobs || [],
        notifications: currentResult.data.notifications || [],
      }}
    />
  );
}
