import VehicleImageInput from '../../components/VehicleImageInput';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
const dateText = (value) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';
const amount = (value) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(value || 0);
const statusClass = (value) => value.toLowerCase().replaceAll(' ', '-');

export default function AdminVehicles() {
  const [search, setSearch] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formMode, setFormMode] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        api
          .get('/admin/vehicles', { params: { search, page }, signal: controller.signal })
          .then(({ data }) => {
            setVehicles(data.vehicles);
            setPages(data.pages);
            setTotal(data.total);
            setError('');
          })
          .catch((requestError) => {
            if (!controller.signal.aborted)
              setError(requestError.response?.data?.message || 'Unable to load vehicles.');
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      search ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, page]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const controller = new AbortController();
    api
      .get(`/admin/vehicles/${selectedId}`, { signal: controller.signal })
      .then(({ data }) => {
        setDetails(data);
        setError('');
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError(requestError.response?.data?.message || 'Unable to load vehicle details.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });
    return () => controller.abort();
  }, [selectedId]);

  async function handleSaved(vehicle, message) {
    setNotice(message);
    setFormMode('');
    setPage(1);
    if (selectedId !== vehicle.id) {
      setDetailsLoading(true);
      setSelectedId(vehicle.id);
    } else {
      try {
        const { data } = await api.get(`/admin/vehicles/${vehicle.id}`);
        setDetails(data);
      } catch {
        /* Keep the saved vehicle visible if the follow-up read fails. */
      }
    }
    try {
      const { data } = await api.get('/admin/vehicles', { params: { search, page: 1 } });
      setVehicles(data.vehicles);
      setPages(data.pages);
      setTotal(data.total);
    } catch {
      /* The detail view remains available if the directory refresh fails. */
    }
  }

  if (selectedId)
    return (
      <div className="admin-vehicles-page">
        <header className="admin-vehicles-heading">
          <div>
            <button
              className="vehicle-back-button"
              onClick={() => {
                setSelectedId('');
                setDetails(null);
                setNotice('');
              }}
            >
              ← All vehicles
            </button>
            <h1 className="page-title">Vehicle profile</h1>
          </div>
          {details?.vehicle && (
            <button className="vehicle-primary-button" onClick={() => setFormMode('edit')}>
              Edit vehicle
            </button>
          )}
        </header>
        {notice && (
          <p className="vehicle-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="vehicle-error" role="alert">
            {error}
          </p>
        )}
        {detailsLoading && !details ? (
          <p role="status">Loading vehicle…</p>
        ) : details ? (
          <VehicleProfile data={details} />
        ) : null}
        {formMode === 'edit' && details && (
          <VehicleForm
            mode="edit"
            vehicle={details.vehicle}
            customer={details.customer}
            onClose={() => setFormMode('')}
            onSaved={handleSaved}
          />
        )}
      </div>
    );

  return (
    <div className="admin-vehicles-page">
      <header className="admin-vehicles-heading">
        <div>
          <h1 className="page-title">Vehicle Management</h1>
          <p className="page-subtitle">
            Search by registration, make, model, or customer and review each vehicle’s workshop
            records.
          </p>
        </div>
        <button className="vehicle-primary-button" onClick={() => setFormMode('add')}>
          + Add vehicle
        </button>
      </header>
      {notice && (
        <p className="vehicle-notice" role="status">
          {notice}
        </p>
      )}
      <section className="section-card vehicle-directory">
        <div className="vehicle-directory-toolbar">
          <label>
            Search vehicles
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Registration, make, model, customer…"
            />
          </label>
          <span>
            {total} vehicle{total === 1 ? '' : 's'}
          </span>
        </div>
        {error && (
          <p className="vehicle-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Loading vehicles…</p>
        ) : vehicles.length ? (
          <div className="vehicle-directory-list">
            {vehicles.map((vehicle) => (
              <button
                type="button"
                className="vehicle-directory-row"
                key={vehicle.id}
                onClick={() => {
                  setDetailsLoading(true);
                  setSelectedId(vehicle.id);
                }}
              >
                <span className="vehicle-symbol">🚘</span>
                <span className="vehicle-directory-identity">
                  <strong>
                    {vehicle.registrationNumber} · {vehicle.year ? `${vehicle.year} ` : ''}
                    {vehicle.make} {vehicle.model}
                  </strong>
                  <small>
                    Owner: {vehicle.customer?.name || 'Customer unavailable'} ·{' '}
                    {vehicle.customer?.email || ''}
                  </small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="vehicle-empty">No vehicles match that search.</p>
        )}
        <footer className="vehicle-pagination">
          <button disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {Math.max(1, pages)}
          </span>
          <button disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)}>
            Next
          </button>
        </footer>
      </section>
      {formMode === 'add' && (
        <VehicleForm mode="add" onClose={() => setFormMode('')} onSaved={handleSaved} />
      )}
    </div>
  );
}

function VehicleForm({ mode, vehicle, customer, onClose, onSaved }) {
  const [latestVehicleYear] = useState(() => new Date().getUTCFullYear() + 1);
  const [form, setForm] = useState({
    customerId: customer?.id || '',
    registrationNumber: vehicle?.registrationNumber || '',
    make: vehicle?.make || '',
    model: vehicle?.model || '',
    year: vehicle?.year || '',
    fuelType: vehicle?.fuelType || '',
    mileage: vehicle?.mileage ?? '',
    vinNumber: vehicle?.vinNumber || '',
    imageUrl: vehicle?.imageUrl || '',
  });
  const [customers, setCustomers] = useState(customer ? [customer] : []);
  const [customerSearch, setCustomerSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        api
          .get('/admin/appointment-options', {
            params: customerSearch ? { search: customerSearch } : {},
            signal: controller.signal,
          })
          .then(({ data }) =>
            setCustomers((current) => {
              const combined = [...current, ...data.customers];
              return [...new Map(combined.map((person) => [person.id, person])).values()];
            }),
          )
          .catch(() => {}),
      customerSearch ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [customerSearch]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { customerId, ...fields } = form;
      const payload = {
        ...fields,
        ...(mode === 'add' || customerId !== customer?.id ? { customerId } : {}),
      };
      const { data } =
        mode === 'add'
          ? await api.post('/admin/vehicles', payload)
          : await api.patch(`/admin/vehicles/${vehicle.id}`, payload);
      await onSaved(
        data.vehicle,
        mode === 'add'
          ? `Vehicle ${data.vehicle.registrationNumber} added for ${data.customer.name}.`
          : `Vehicle ${data.vehicle.registrationNumber} updated.`,
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save vehicle details.');
    } finally {
      setSaving(false);
    }
  }
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  return (
    <div className="vehicle-modal-backdrop">
      <section
        className="vehicle-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-form-title"
      >
        <header>
          <h2 id="vehicle-form-title">{mode === 'add' ? 'Add vehicle' : 'Edit vehicle'}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {error && (
          <p className="vehicle-error" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={submit}>
          {mode === 'add' && (
            <label className="vehicle-form-wide">
              Search customer
              <input
                type="search"
                placeholder="Name, email or mobile"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
              />
            </label>
          )}
          <label className="vehicle-form-wide">
            Owner
            <select
              required
              value={form.customerId}
              onChange={(event) => update('customerId', event.target.value)}
            >
              {mode === 'add' && <option value="">Select a customer</option>}
              {customers.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} · {person.email}
                </option>
              ))}
            </select>
          </label>
          <div className="vehicle-form-grid">
            <label>
              Registration number
              <input
                required
                maxLength="32"
                value={form.registrationNumber}
                onChange={(event) => update('registrationNumber', event.target.value)}
              />
            </label>
            <label>
              Make
              <input
                required
                maxLength="80"
                value={form.make}
                onChange={(event) => update('make', event.target.value)}
              />
            </label>
            <label>
              Model
              <input
                required
                maxLength="80"
                value={form.model}
                onChange={(event) => update('model', event.target.value)}
              />
            </label>
            <label>
              Year
              <input
                type="number"
                min="1886"
                max={latestVehicleYear}
                value={form.year}
                onChange={(event) => update('year', event.target.value)}
              />
            </label>
            <label>
              Fuel type
              <input
                maxLength="50"
                value={form.fuelType}
                onChange={(event) => update('fuelType', event.target.value)}
              />
            </label>
            <label>
              Current mileage
              <input
                type="number"
                min="0"
                max="10000000"
                value={form.mileage}
                onChange={(event) => update('mileage', event.target.value)}
              />
            </label>
            <label>
              VIN
              <input
                maxLength="32"
                value={form.vinNumber}
                onChange={(event) => update('vinNumber', event.target.value)}
              />
            </label>
            <VehicleImageInput
              value={form.imageUrl}
              disabled={saving}
              onChange={(value) => update('imageUrl', value)}
            />
          </div>
          <footer>
            <button
              type="button"
              className="vehicle-secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="vehicle-primary-button" disabled={saving || !form.customerId}>
              {saving ? 'Saving…' : mode === 'add' ? 'Add vehicle' : 'Save changes'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function VehicleProfile({ data }) {
  const { vehicle, customer, currentJobs, previousJobs, appointments, invoices } = data;
  return (
    <div className="vehicle-profile-page">
      <section className="vehicle-profile-card section-card">
        <div className="vehicle-profile-main">
          {vehicle.imageUrl ? (
            <img src={vehicle.imageUrl} alt={`${vehicle.make} ${vehicle.model}`} />
          ) : (
            <span className="vehicle-profile-symbol">🚘</span>
          )}
          <div>
            <h2>
              {vehicle.year ? `${vehicle.year} ` : ''}
              {vehicle.make} {vehicle.model}
            </h2>
            <strong>{vehicle.registrationNumber}</strong>
            <p>
              {vehicle.fuelType || 'Fuel type not recorded'} ·{' '}
              {vehicle.mileage ?? 'Mileage not recorded'} km
            </p>
            <p>VIN: {vehicle.vinNumber || 'Not recorded'}</p>
          </div>
        </div>
        <div className="vehicle-owner">
          <span>Registered customer</span>
          {customer ? (
            <>
              <Link to={`/admin/customers`}>{customer.name}</Link>
              <small>
                {customer.email} · {customer.mobile}
              </small>
            </>
          ) : (
            <strong>Customer unavailable</strong>
          )}
        </div>
      </section>
      <section className="section-card vehicle-detail-section">
        <header>
          <h2>Active jobs</h2>
          <span>{currentJobs.length}</span>
        </header>
        {currentJobs.length ? (
          <div className="vehicle-record-grid">
            {currentJobs.map((job) => (
              <article key={job.id}>
                <strong>
                  {job.reference} · {job.status}
                </strong>
                <span>
                  {job.serviceType} · {job.technician}
                </span>
                <small>Updated {dateText(job.updatedAt)}</small>
                {job.timeline?.length > 0 && (
                  <p>{job.timeline.at(-1).notes || job.timeline.at(-1).status}</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="vehicle-empty">No active jobs for this vehicle.</p>
        )}
      </section>
      <section className="section-card vehicle-detail-section">
        <header>
          <h2>Previous jobs & service history</h2>
          <span>{previousJobs.length}</span>
        </header>
        {previousJobs.length ? (
          <div className="vehicle-record-grid">
            {previousJobs.map((job) => (
              <article key={job.id}>
                <strong>
                  {job.reference} · {job.status}
                </strong>
                <span>
                  {job.serviceType} · {job.technician}
                </span>
                <small>Service date: {dateText(job.completedAt)}</small>
                {job.timeline?.map((event, index) => (
                  <small key={`${event.status}-${index}`}>
                    {event.status} · {dateText(event.timestamp)}
                    {event.notes ? ` · ${event.notes}` : ''}
                  </small>
                ))}
              </article>
            ))}
          </div>
        ) : (
          <p className="vehicle-empty">No previous service jobs.</p>
        )}
      </section>
      <section className="section-card vehicle-detail-section">
        <header>
          <h2>Appointments</h2>
          <span>{appointments.length}</span>
        </header>
        {appointments.length ? (
          <div className="vehicle-table-wrap">
            <table className="vehicle-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date / time</th>
                  <th>Service</th>
                  <th>Technician</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((item) => (
                  <tr key={item.id}>
                    <td>{item.reference}</td>
                    <td>
                      {dateText(item.preferredDate)} · {item.preferredTime}
                    </td>
                    <td>{item.serviceType}</td>
                    <td>{item.technician}</td>
                    <td>
                      <span className={`vehicle-status ${statusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vehicle-empty">No appointments on record.</p>
        )}
      </section>
      <section className="section-card vehicle-detail-section">
        <header>
          <h2>Invoices</h2>
          <span>{invoices.length}</span>
        </header>
        {invoices.length ? (
          <div className="vehicle-table-wrap">
            <table className="vehicle-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Service job</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{invoice.serviceNumber}</td>
                    <td>{amount(invoice.totalAmount)}</td>
                    <td>{amount(invoice.amountPaid)}</td>
                    <td>{amount(invoice.amountDue)}</td>
                    <td>
                      <span className={`vehicle-status ${statusClass(invoice.paymentStatus)}`}>
                        {invoice.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vehicle-empty">No invoices are available.</p>
        )}
      </section>
    </div>
  );
}
