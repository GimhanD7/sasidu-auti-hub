import { serviceStatus } from '../../lib/serviceStatus';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
const dateTime = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
};
const money = (value) =>
  value == null || !Number.isFinite(Number(value))
    ? 'Not available'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'LKR',
        maximumFractionDigits: 2,
      }).format(Number(value));
const vehicleLabel = (vehicle) =>
  vehicle
    ? `${vehicle.year ? `${vehicle.year} ` : ''}${vehicle.make} ${vehicle.model}${vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ''}`
    : 'Vehicle details unavailable';
const searchableText = (record) =>
  [
    record.serviceNumber,
    record.serviceType,
    record.status,
    record.technician,
    record.vehicle && vehicleLabel(record.vehicle),
    record.invoice?.invoiceNumber,
    ...(record.completedWork || []).map((task) => `${task.title} ${task.notes}`),
    ...(record.replacedParts || []).map((part) => `${part.name} ${part.partNumber}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

function downloadRecord(record) {
  const vehicle = vehicleLabel(record.vehicle);
  const lines = [
    'AUTOSERV PRO — SERVICE RECORD',
    `Service number: ${record.serviceNumber}`,
    `Vehicle: ${vehicle}`,
    `Service type: ${record.serviceType}`,
    `Service date: ${dateTime(record.serviceDate)}`,
    `Status: ${serviceStatus(record.status)}`,
    `Technician: ${record.technician || 'Not recorded'}`,
    `Mileage: ${record.mileageAtService == null ? 'Not recorded' : `${new Intl.NumberFormat().format(record.mileageAtService)} km`}`,
    '',
    'COMPLETED WORK',
    ...(record.completedWork.length
      ? record.completedWork.map((task) => `- ${task.title}${task.notes ? `: ${task.notes}` : ''}`)
      : ['No completed tasks recorded.']),
    '',
    'REPLACED PARTS',
    ...(record.replacedParts.length
      ? record.replacedParts.map(
          (part) =>
            `- ${part.name}${part.partNumber ? ` (${part.partNumber})` : ''}${part.quantity != null ? ` × ${part.quantity}` : ''}${part.unitCost != null ? ` — ${money(part.unitCost)} each` : ''}`,
        )
      : ['No replaced parts recorded.']),
    '',
    'INVOICE',
    ...(record.invoice
      ? [
          `Invoice number: ${record.invoice.invoiceNumber}`,
          `Parts: ${money(record.invoice.partsCost)}`,
          `Labour: ${money(record.invoice.labourCost)}`,
          `Additional repairs: ${money(record.invoice.additionalRepairsCost)}`,
          `Tax: ${money(record.invoice.tax)}`,
          `Discount: ${money(record.invoice.discount)}`,
          `Total: ${money(record.invoice.totalAmount)}`,
          `Payment status: ${record.invoice.paymentStatus}`,
        ]
      : ['No invoice available.']),
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${record.serviceNumber.toLowerCase()}-service-record.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ServiceRecord({ record }) {
  return (
    <article className="service-history-card">
      <header className="history-card-heading">
        <div>
          <p className="history-eyebrow">{record.serviceNumber}</p>
          <h2>{record.serviceType}</h2>
          <p>{vehicleLabel(record.vehicle)}</p>
        </div>
        <span className="history-status">{serviceStatus(record.status)}</span>
      </header>
      <dl className="history-details">
        <div>
          <dt>Service date</dt>
          <dd>{dateTime(record.serviceDate)}</dd>
        </div>
        <div>
          <dt>Technician</dt>
          <dd>{record.technician || 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Mileage</dt>
          <dd>
            {record.mileageAtService == null
              ? 'Not recorded'
              : `${new Intl.NumberFormat().format(record.mileageAtService)} km`}
          </dd>
        </div>
        <div>
          <dt>Invoice total</dt>
          <dd>{record.invoice ? money(record.invoice.totalAmount) : 'No invoice'}</dd>
        </div>
      </dl>
      <div className="history-record-sections">
        <section>
          <h3>Completed work</h3>
          {record.completedWork.length ? (
            <ul>
              {record.completedWork.map((task, index) => (
                <li key={`${task.title}-${index}`}>
                  <strong>{task.title}</strong>
                  {task.notes && <p>{task.notes}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="history-muted">No completed tasks recorded.</p>
          )}
        </section>
        <section>
          <h3>Replaced parts</h3>
          {record.replacedParts.length ? (
            <ul>
              {record.replacedParts.map((part, index) => (
                <li key={`${part.name}-${index}`}>
                  <strong>{part.name}</strong>
                  {part.partNumber && <p>Part number: {part.partNumber}</p>}
                  <p>
                    {part.quantity != null ? `Quantity: ${part.quantity}` : 'Quantity not recorded'}
                    {part.unitCost != null ? ` · ${money(part.unitCost)} each` : ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="history-muted">No replaced parts recorded.</p>
          )}
        </section>
      </div>
      {record.invoice && (
        <details className="history-invoice">
          <summary>
            Invoice {record.invoice.invoiceNumber} · {record.invoice.paymentStatus}
          </summary>
          <dl>
            <div>
              <dt>Parts</dt>
              <dd>{money(record.invoice.partsCost)}</dd>
            </div>
            <div>
              <dt>Labour</dt>
              <dd>{money(record.invoice.labourCost)}</dd>
            </div>
            <div>
              <dt>Additional repairs</dt>
              <dd>{money(record.invoice.additionalRepairsCost)}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{money(record.invoice.tax)}</dd>
            </div>
            <div>
              <dt>Discount</dt>
              <dd>−{money(record.invoice.discount)}</dd>
            </div>
            <div className="history-total">
              <dt>Total</dt>
              <dd>{money(record.invoice.totalAmount)}</dd>
            </div>
          </dl>
        </details>
      )}
      {record.timeline.length > 0 && (
        <details className="history-timeline">
          <summary>Service timeline ({record.timeline.length} updates)</summary>
          <ol>
            {record.timeline.map((event, index) => (
              <li key={`${event.timestamp || index}-${index}`}>
                <strong>{event.status}</strong>
                <time>{dateTime(event.timestamp)}</time>
                {event.notes && <p>{event.notes}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
      <footer className="history-card-footer">
        <Link
          to={record.vehicle?.id ? `/customer/vehicles/${record.vehicle.id}` : '/customer/vehicles'}
        >
          Vehicle profile
        </Link>
        <button type="button" onClick={() => downloadRecord(record)}>
          Download service record
        </button>
      </footer>
    </article>
  );
}

export default function CustomerServiceHistory() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [vehicleId, setVehicleId] = useState('all');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/service-history', { signal: controller.signal })
      .then(({ data: response }) => {
        if (!controller.signal.aborted) {
          setData(response);
          setError('');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.response?.data?.message || 'Unable to load your service history.');
      });
    return () => controller.abort();
  }, [retry]);

  const filtered = useMemo(
    () =>
      (data?.records || []).filter(
        (record) =>
          (vehicleId === 'all' || record.vehicle?.id === vehicleId) &&
          searchableText(record).includes(search.trim().toLowerCase()),
      ),
    [data, search, vehicleId],
  );

  return (
    <main className="customer-service-history-page">
      <header className="service-history-heading">
        <div>
          <p className="history-eyebrow">YOUR VEHICLES</p>
          <h1>Service History</h1>
          <p>Past workshop visits, completed work and invoice totals.</p>
        </div>
        <Link to="/customer/vehicles">My vehicles</Link>
      </header>
      <div className="history-filters">
        <label>
          Vehicle
          <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
            <option value="all">All vehicles</option>
            {data?.vehicles.map((vehicle) => (
              <option value={vehicle.id} key={vehicle.id}>
                {vehicleLabel(vehicle)}
              </option>
            ))}
          </select>
        </label>
        <label className="history-search">
          Search records
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Service, job number, technician, part…"
          />
        </label>
        <span>{data ? `${filtered.length} record${filtered.length === 1 ? '' : 's'}` : ''}</span>
      </div>
      {error && (
        <div className="history-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Try again
          </button>
        </div>
      )}
      {!data && !error && (
        <p className="history-loading" role="status">
          Loading service history…
        </p>
      )}
      {data?.records.length === 0 && (
        <section className="history-empty">
          <h2>No previous services yet</h2>
          <p>Completed workshop visits will appear here.</p>
          <Link to="/customer/appointments">Book a service appointment</Link>
        </section>
      )}
      {data?.records.length > 0 && filtered.length === 0 && (
        <section className="history-empty">
          <h2>No matching service records</h2>
          <p>Change the vehicle filter or search terms to see more records.</p>
        </section>
      )}
      <div className="service-history-list">
        {filtered.map((record) => (
          <ServiceRecord record={record} key={record.id} />
        ))}
      </div>
    </main>
  );
}
