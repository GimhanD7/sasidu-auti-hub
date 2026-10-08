import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import './CustomerVehicleProfile.css';

const dateLabel = value => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
};
const numberLabel = value => value == null ? 'Not recorded' : new Intl.NumberFormat().format(value);
const amountLabel = value => value == null ? '—' : new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const safeDocumentUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
};

function EmptyNote({ children }) { return <p className="profile-empty-note">{children}</p>; }

export default function CustomerVehicleProfile() {
  const { vehicleId } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.get(`/vehicles/${vehicleId}/profile`, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) { setProfile(data); setError(''); } })
      .catch(requestError => { if (!controller.signal.aborted) setError(requestError.response?.data?.message || 'Unable to load this vehicle profile. Please try again.'); });
    return () => controller.abort();
  }, [vehicleId, retry]);

  if (error) return <main className="vehicle-profile-page"><Link className="profile-back-link" to="/customer/vehicles">← My vehicles</Link><div className="vehicle-profile-error" role="alert"><p>{error}</p><button className="btn-outline" type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div></main>;
  if (!profile) return <main className="vehicle-profile-page"><p className="profile-loading" role="status">Loading vehicle profile…</p></main>;

  const { vehicle, currentRepairs, history, appointments, lastServiceMileage, recommendations } = profile;
  return <main className="vehicle-profile-page">
    <Link className="profile-back-link" to="/customer/vehicles">← My vehicles</Link>
    <section className="vehicle-profile-hero">
      {vehicle.imageUrl ? <img src={vehicle.imageUrl} alt={`${vehicle.make} ${vehicle.model}`} /> : <div className="profile-image-placeholder" aria-hidden="true">🚗</div>}
      <div className="vehicle-profile-heading"><span className="profile-eyebrow">VEHICLE PROFILE</span><h1>{vehicle.year ? `${vehicle.year} ` : ''}{vehicle.make} {vehicle.model}</h1><span className="profile-registration">{vehicle.registrationNumber}</span><p>Full vehicle information, workshop updates, service records and invoices.</p></div>
      <Link className="profile-edit-link" to="/customer/vehicles">Manage vehicles</Link>
    </section>

    <section className="profile-section">
      <div className="profile-section-heading"><div><span className="profile-eyebrow">VEHICLE</span><h2>Vehicle information</h2></div></div>
      <dl className="profile-info-grid">
        <div><dt>Registration number</dt><dd>{vehicle.registrationNumber}</dd></div>
        <div><dt>Make</dt><dd>{vehicle.make}</dd></div>
        <div><dt>Model</dt><dd>{vehicle.model}</dd></div>
        <div><dt>Year</dt><dd>{vehicle.year || 'Not provided'}</dd></div>
        <div><dt>Fuel type</dt><dd>{vehicle.fuelType || 'Not provided'}</dd></div>
        <div><dt>Current mileage</dt><dd>{vehicle.mileage == null ? 'Not provided' : `${numberLabel(vehicle.mileage)} km`}</dd></div>
        <div><dt>Last service mileage</dt><dd>{lastServiceMileage == null ? 'Not recorded' : `${numberLabel(lastServiceMileage)} km`}</dd></div>
        <div><dt>VIN / chassis number</dt><dd>{vehicle.vinNumber || 'Not provided'}</dd></div>
        <div><dt>Registered</dt><dd>{dateLabel(vehicle.createdAt)}</dd></div>
      </dl>
    </section>

    <section className="profile-section">
      <div className="profile-section-heading"><div><span className="profile-eyebrow">WORKSHOP</span><h2>Current repair</h2></div></div>
      {currentRepairs.length ? <div className="profile-record-list">{currentRepairs.map(job => <article className="profile-repair-card" key={job.id}>
        <div className="profile-record-top"><strong>{job.serviceType}</strong><span className="profile-status-pill">{job.status}</span></div>
        <dl className="profile-compact-grid"><div><dt>Technician</dt><dd>{job.technician || 'Not assigned'}</dd></div><div><dt>Priority</dt><dd>{job.priority || 'Normal'}</dd></div><div><dt>Estimated completion</dt><dd>{dateLabel(job.expectedCompletionTime)}</dd></div><div><dt>Last updated</dt><dd>{dateLabel(job.updatedAt)}</dd></div></dl>
      </article>)}</div> : <EmptyNote>No active repair is recorded for this vehicle.</EmptyNote>}
      {appointments.length > 0 && <div className="profile-appointments"><h3>Recent appointments</h3><div className="profile-table-scroll"><table><thead><tr><th>Service</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>{appointments.map(item => <tr key={item._id}><td>{item.serviceType}</td><td>{dateLabel(item.preferredDate)}</td><td>{item.preferredTime}</td><td>{item.status}</td></tr>)}</tbody></table></div></div>}
    </section>

    <section className="profile-section">
      <div className="profile-section-heading"><div><span className="profile-eyebrow">RECORDS</span><h2>Previous services and repairs</h2></div></div>
      {history.length ? <div className="profile-record-list">{history.map(record => <article className="profile-history-card" key={record.id}>
        <div className="profile-record-top"><div><h3>{record.serviceType}</h3><p>{dateLabel(record.serviceDate)} · {record.status}</p></div><span className="profile-priority-pill">{record.priority || 'Normal'}</span></div>
        <p className="profile-record-meta">Technician: {record.technician || 'Not recorded'} <span>·</span> Mileage at service: {record.mileageAtService == null ? 'Not recorded' : `${numberLabel(record.mileageAtService)} km`}</p>
        {record.timeline?.length > 0 && <details className="profile-expand"><summary>Workshop updates ({record.timeline.length})</summary><ul>{record.timeline.map((event, index) => <li key={`${event.timestamp || index}-${index}`}><strong>{event.status || 'Update'}</strong><span>{dateLabel(event.timestamp)}</span>{event.notes && <p>{event.notes}</p>}</li>)}</ul></details>}
        {record.invoice && <details className="profile-expand"><summary>Invoice {record.invoice.invoiceNumber} · {record.invoice.paymentStatus}</summary><dl className="profile-invoice-lines"><div><dt>Parts</dt><dd>{amountLabel(record.invoice.partsCost)}</dd></div><div><dt>Labour</dt><dd>{amountLabel(record.invoice.labourCost)}</dd></div><div><dt>Additional repairs</dt><dd>{amountLabel(record.invoice.additionalRepairsCost)}</dd></div><div><dt>Tax</dt><dd>{amountLabel(record.invoice.tax)}</dd></div><div><dt>Discount</dt><dd>−{amountLabel(record.invoice.discount)}</dd></div><div className="profile-invoice-total"><dt>Total</dt><dd>{amountLabel(record.invoice.totalAmount)}</dd></div></dl></details>}
        {record.documents?.length > 0 && <div className="profile-documents"><strong>Repair and service documents</strong><ul>{record.documents.map((document, index) => { const href = safeDocumentUrl(document.url); return <li key={`${document.url}-${index}`}>{href ? <a href={href} target="_blank" rel="noreferrer">{document.title || 'Open document'}</a> : <span>{document.title || 'Document'} (link unavailable)</span>}<small>Added {dateLabel(document.uploadedAt)}</small></li>; })}</ul></div>}
        {!record.documents?.length && <p className="profile-record-meta">No documents are attached to this service record.</p>}
      </article>)}</div> : <EmptyNote>No completed service or repair records are available yet.</EmptyNote>}
    </section>

    <section className="profile-section">
      <div className="profile-section-heading"><div><span className="profile-eyebrow">MAINTENANCE</span><h2>Service recommendations</h2></div></div>
      {recommendations.length ? <div className="profile-recommendations">{recommendations.map((item, index) => <article key={`${item.title}-${index}`}><h3>{item.title || 'Recommended service'}</h3>{item.description && <p>{item.description}</p>}<div className="profile-recommendation-due">{item.dueAt && <span>Due by {dateLabel(item.dueAt)}</span>}{item.dueMileage != null && <span>At {numberLabel(item.dueMileage)} km</span>}{!item.dueAt && item.dueMileage == null && <span>Due date not specified</span>}</div></article>)}</div> : <EmptyNote>No workshop recommendations have been recorded for this vehicle.</EmptyNote>}
    </section>
  </main>;
}
