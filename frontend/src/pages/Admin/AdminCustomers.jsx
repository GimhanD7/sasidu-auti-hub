// Search customer accounts, open related profile details, and submit account creation or editing forms.
import { serviceStatus, invoiceStatus } from '../../lib/serviceStatus';
import { useEffect, useState } from 'react';
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

export default function AdminCustomers() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [customerDetails, setCustomerDetails] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [formMode, setFormMode] = useState('');

  // Load server data when these effect dependencies change; cleanup below prevents stale work from updating this view.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setListLoading(true);
        api
          .get('/admin/customers', { params: { search, page }, signal: controller.signal })
          .then(({ data }) => {
            setCustomers(data.customers);
            setPages(data.pages);
            setTotal(data.total);
            setError('');
          })
          .catch((requestError) => {
            if (!controller.signal.aborted)
              setError(requestError.response?.data?.message || 'Unable to load customers.');
          })
          .finally(() => {
            if (!controller.signal.aborted) setListLoading(false);
          });
      },
      search ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, page]);

  // Load server data when these effect dependencies change; cleanup below prevents stale work from updating this view.
  useEffect(() => {
    if (!selectedId) return undefined;
    const controller = new AbortController();
    api
      .get(`/admin/customers/${selectedId}`, { signal: controller.signal })
      .then(({ data }) => {
        setCustomerDetails(data);
        setError('');
      })
      .catch((requestError) => {
        if (!controller.signal.aborted)
          setError(requestError.response?.data?.message || 'Unable to load customer details.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });
    return () => controller.abort();
  }, [selectedId]);

  function openForm(mode) {
    setError('');
    setFormMode(mode);
  }

  async function handleSaved(customer, message) {
    setNotice(message);
    setFormMode('');
    setPage(1);
    if (selectedId !== customer.id) {
      setDetailsLoading(true);
      setSelectedId(customer.id);
    } else {
      try {
        const { data } = await api.get(`/admin/customers/${customer.id}`);
        setCustomerDetails(data);
      } catch {
        /* Keep the saved profile visible if its follow-up read fails. */
      }
    }
    try {
      const { data } = await api.get('/admin/customers', { params: { search, page: 1 } });
      setCustomers(data.customers);
      setPages(data.pages);
      setTotal(data.total);
    } catch {
      /* The customer detail request remains available even if the list refresh fails. */
    }
  }

  async function toggleStatus() {
    if (statusSaving) return;
    setStatusSaving(true);
    setError('');
    try {
      // Request a server-side change; update the displayed state from the successful response below.
      const { data } = await api.patch(`/admin/customers/${selectedId}/status`, {
        isActive: !customerDetails.customer.isActive,
      });
      setCustomerDetails((current) => ({
        ...current,
        customer: { ...current.customer, isActive: data.isActive },
      }));
      setCustomers((current) =>
        current.map((item) =>
          item.id === selectedId ? { ...item, isActive: data.isActive } : item,
        ),
      );
      setNotice(data.message);
    } catch (error) {
      setError(error.response?.data?.message || 'Unable to update account status.');
    } finally {
      setStatusSaving(false);
    }
  }
  if (selectedId) {
    return (
      <div className="admin-customers-page">
        <div className="admin-customers-heading">
          <div>
            <button
              className="customer-back-button"
              onClick={() => {
                setSelectedId('');
                setCustomerDetails(null);
                setNotice('');
              }}
            >
              ← All customers
            </button>
            <h1 className="page-title">Customer profile</h1>
          </div>
          {customerDetails?.customer && (
            <button className="customer-action-button" onClick={() => openForm('edit')}>
              Edit customer
            </button>
          )}
        </div>
        {customerDetails?.customer && selectedId && (
          <button className="customer-action-button" disabled={statusSaving} onClick={toggleStatus}>
            {statusSaving
              ? 'Updating…'
              : customerDetails.customer.isActive
                ? 'Suspend account'
                : 'Reactivate account'}
          </button>
        )}
        {notice && (
          <p className="customer-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="customer-error" role="alert">
            {error}
          </p>
        )}
        {detailsLoading && !customerDetails ? (
          <p role="status">Loading customer…</p>
        ) : customerDetails ? (
          <CustomerProfile data={customerDetails} onEdit={() => openForm('edit')} />
        ) : null}
        {formMode && customerDetails && (
          <CustomerForm
            mode="edit"
            customer={customerDetails.customer}
            onClose={() => setFormMode('')}
            onSaved={handleSaved}
          />
        )}
      </div>
    );
  }

  return (
    <div className="admin-customers-page">
      <header className="admin-customers-heading">
        <div>
          <h1 className="page-title">Customer Management</h1>
          <p className="page-subtitle">
            Search customer records and review vehicles, service, appointments, and account
            balances.
          </p>
        </div>
        <button className="customer-action-button" onClick={() => openForm('add')}>
          + Add customer
        </button>
      </header>
      {customerDetails?.customer && selectedId && (
        <button className="customer-action-button" disabled={statusSaving} onClick={toggleStatus}>
          {statusSaving
            ? 'Updating…'
            : customerDetails.customer.isActive
              ? 'Suspend account'
              : 'Reactivate account'}
        </button>
      )}
      {notice && (
        <p className="customer-notice" role="status">
          {notice}
        </p>
      )}
      <section className="customer-directory section-card">
        <div className="customer-directory-toolbar">
          <label>
            Search customers
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Name, email, or mobile number"
            />
          </label>
          <span>
            {total} customer{total === 1 ? '' : 's'}
          </span>
        </div>
        {error && (
          <p className="customer-error" role="alert">
            {error}
          </p>
        )}
        {listLoading ? (
          <p role="status">Loading customers…</p>
        ) : customers.length ? (
          <div className="customer-directory-list">
            {customers.map((customer) => (
              <button
                type="button"
                className="customer-directory-row"
                key={customer.id}
                onClick={() => {
                  setDetailsLoading(true);
                  setSelectedId(customer.id);
                }}
              >
                <span className="customer-avatar">
                  {customer.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </span>
                <span className="customer-directory-identity">
                  <strong>{customer.name}</strong>
                  <small>
                    {customer.email} · {customer.mobile || 'No mobile recorded'}
                  </small>
                </span>
                <span
                  className={`customer-active-state ${customer.isActive ? 'active' : 'inactive'}`}
                >
                  {customer.isActive ? 'Active' : 'Inactive'}
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="customer-empty">No customers match that search.</p>
        )}
        <footer className="customer-pagination">
          <button disabled={page <= 1 || listLoading} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {Math.max(1, pages)}
          </span>
          <button
            disabled={page >= pages || listLoading}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </footer>
      </section>
      {formMode === 'add' && (
        <CustomerForm mode="add" onClose={() => setFormMode('')} onSaved={handleSaved} />
      )}
    </div>
  );
}

function CustomerForm({ mode, customer, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    mobile: customer?.mobile || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } =
        mode === 'add'
          ? await api.post('/admin/customers', form)
          : await api.patch(`/admin/customers/${customer.id}`, form);
      const message =
        mode === 'add'
          ? `Customer ${data.customer.name} added.${data.accountSetupEmailSent ? ' Account setup email sent.' : ' Default password: 12345678. Ask the customer to change it in Profile.'}`
          : `Customer details for ${data.customer.name} updated.`;
      await onSaved(data.customer, message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save customer details.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="customer-modal-backdrop" role="presentation">
      <section
        className="customer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-form-title"
      >
        <header>
          <h2 id="customer-form-title">{mode === 'add' ? 'Add customer' : 'Edit customer'}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {error && (
          <p className="customer-error" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={submit}>
          <label>
            Full name
            <input
              required
              minLength="2"
              maxLength="100"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              maxLength="254"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label>
            Mobile number
            <input
              required
              type="tel"
              value={form.mobile}
              onChange={(event) => setForm({ ...form, mobile: event.target.value })}
            />
          </label>
          {mode === 'add' && (
            <p className="customer-form-hint">
              Default password: 12345678. The customer can change it in Profile. An account setup
              email is also sent when available.
            </p>
          )}
          <footer>
            <button
              type="button"
              className="customer-secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="customer-action-button" disabled={saving}>
              {saving ? 'Saving…' : mode === 'add' ? 'Add customer' : 'Save changes'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function CustomerProfile({ data }) {
  const { customer, vehicles, appointments, currentJobs, serviceHistory, invoices, summary } = data;
  return (
    <div className="customer-profile-page">
      <section className="customer-profile-card section-card">
        <div className="customer-profile-main">
          <span className="customer-avatar large">
            {customer.name
              .split(/\s+/)
              .map((part) => part[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </span>
          <div>
            <h2>{customer.name}</h2>
            <p>{customer.email}</p>
            <p>
              {customer.mobile || 'No mobile recorded'} ·{' '}
              {customer.isActive ? 'Active account' : 'Inactive account'}
            </p>
          </div>
        </div>
        <div className="customer-summary-cards">
          {[
            ['Vehicles', summary.vehicles],
            ['Appointments', summary.appointments],
            ['Current jobs', summary.currentJobs],
            ['Service history', summary.serviceHistory],
            ['Outstanding invoices', summary.outstandingInvoices],
            ['Outstanding amount', amount(summary.outstandingAmount)],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section-card customer-detail-section">
        <header>
          <h2>Vehicles</h2>
          <span>{vehicles.length}</span>
        </header>
        {vehicles.length ? (
          <div className="customer-vehicle-grid">
            {vehicles.map((vehicle) => (
              <article key={vehicle.id}>
                <strong>
                  {vehicle.year ? `${vehicle.year} ` : ''}
                  {vehicle.make} {vehicle.model}
                </strong>
                <span>{vehicle.registrationNumber}</span>
                <small>
                  VIN: {vehicle.vinNumber || 'Not recorded'} · Mileage:{' '}
                  {vehicle.mileage ?? 'Not recorded'}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className="customer-empty">No vehicles registered.</p>
        )}
      </section>

      <section className="section-card customer-detail-section">
        <header>
          <h2>Appointments</h2>
          <span>{appointments.length}</span>
        </header>
        {appointments.length ? (
          <div className="customer-table-wrap">
            <table className="customer-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Date / time</th>
                  <th>Service</th>
                  <th>Vehicle</th>
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
                    <td>{item.vehicle}</td>
                    <td>{item.technician}</td>
                    <td>
                      <span className={`customer-status ${statusClass(item.status)}`}>
                        {serviceStatus(item.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="customer-empty">No appointments on record.</p>
        )}
      </section>

      <section className="section-card customer-detail-section">
        <header>
          <h2>Current jobs</h2>
          <span>{currentJobs.length}</span>
        </header>
        {currentJobs.length ? (
          <div className="customer-record-grid">
            {currentJobs.map((job) => (
              <article key={job.id}>
                <strong>
                  {job.reference} · {serviceStatus(job.status)}
                </strong>
                <span>
                  {job.serviceType} · {job.vehicle}
                </span>
                <small>
                  Technician: {job.technician} · Updated {dateText(job.updatedAt)}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className="customer-empty">No current service jobs.</p>
        )}
      </section>

      <section className="section-card customer-detail-section">
        <header>
          <h2>Service history</h2>
          <span>{serviceHistory.length}</span>
        </header>
        {serviceHistory.length ? (
          <div className="customer-record-grid">
            {serviceHistory.map((job) => (
              <article key={job.id}>
                <strong>
                  {job.reference} · {serviceStatus(job.status)}
                </strong>
                <span>
                  {job.serviceType} · {job.vehicle}
                </span>
                <small>
                  Technician: {job.technician} · {dateText(job.completedAt)}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className="customer-empty">No completed service history yet.</p>
        )}
      </section>

      <section className="section-card customer-detail-section">
        <header>
          <h2>Invoices & outstanding payments</h2>
          <span>{invoices.length}</span>
        </header>
        {invoices.length ? (
          <div className="customer-table-wrap">
            <table className="customer-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Job</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Amount due</th>
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
                      <span className={`customer-status ${statusClass(invoice.paymentStatus)}`}>
                        {invoiceStatus(invoice.paymentStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="customer-empty">No invoices are available.</p>
        )}
      </section>
    </div>
  );
}
