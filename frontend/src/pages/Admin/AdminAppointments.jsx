// Manage workshop appointments through booking and edit dialogs, including technician selection and conversion into a service job.
import { serviceStatus } from '../../lib/serviceStatus';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

const formatDate = (value) => {
  if (!value) return '';
  const day = typeof value === 'string' ? value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] : null;
  const date = day ? new Date(`${day}T12:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
};

const STATUSES = ['Pending', 'Confirmed', 'In Service', 'Completed', 'Cancelled'];

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Confirmed':
      return 'badge-success';
    case 'In Service':
      return 'badge-primary';
    case 'Completed':
      return 'badge-success';
    case 'Cancelled':
      return 'badge-danger';
    case 'Pending':
    default:
      return 'badge-warning';
  }
}

export default function AdminAppointments() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [records, setRecords] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [managedAppointmentId, setManagedAppointmentId] = useState('');

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (technicianFilter) params.technician = technicianFilter;
      if (dateFilter) {
        const nextDay = new Date(new Date(`${dateFilter}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000);
        params.start = `${dateFilter}T00:00:00.000Z`;
        params.end = nextDay.toISOString();
      }
      const { data } = await api.get('/admin/appointments', { params });
      setRecords(data.appointments || []);
      setTechnicians(data.technicians || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, technicianFilter, dateFilter]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Filter records by search text
  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((item) =>
      [
        item.reference,
        item.appointmentNumber,
        item.customer,
        item.email,
        item.mobile,
        item.vehicle,
        item.registrationNumber,
        item.serviceType,
        item.technician,
        item.status,
      ].some((val) => val?.toLowerCase().includes(q))
    );
  }, [records, search]);

  return (
    <div className="admin-appointments" style={{ padding: '1.25rem', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Header */}
      <header className="appointment-page-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>Appointments</h1>
          <p className="page-subtitle" style={{ margin: '0.25rem 0 0', color: 'var(--text-muted, #64748b)' }}>
            View and manage workshop bookings and customer appointments.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setSuccessMessage('');
              setShowBookingModal(true);
            }}
            style={{ padding: '0.6rem 1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px', cursor: 'pointer' }}
          >
            <span>+</span> New Appointment
          </button>
          <button
            type="button"
            onClick={loadAppointments}
            disabled={loading}
            style={{ padding: '0.6rem 1rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '8px', cursor: 'pointer' }}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </header>

      {/* Success banner */}
      {successMessage && (
        <div style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✓ {successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage('')} style={{ background: 'transparent', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ background: 'var(--bg-card, #161619)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #b3b3bc)', fontWeight: 600, marginBottom: '0.2rem' }}>Search</label>
            <input
              type="search"
              placeholder="Search customer, plate, service…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '8px', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #b3b3bc)', fontWeight: 600, marginBottom: '0.2rem' }}>Date Filter</label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ flex: 1, padding: '0.55rem 0.75rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '8px', fontSize: '0.9rem' }}
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  title="Clear Date"
                  style={{ padding: '0 0.5rem', background: '#27272a', color: '#f4f4f5', border: '1px solid #52525b', borderRadius: '8px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #b3b3bc)', fontWeight: 600, marginBottom: '0.2rem' }}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '8px', fontSize: '0.9rem' }}
            >
              <option value="">All Statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {serviceStatus(status)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #b3b3bc)', fontWeight: 600, marginBottom: '0.2rem' }}>Technician</label>
            <select
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.75rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '8px', fontSize: '0.9rem' }}
            >
              <option value="">All Technicians</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Appointments List / Table */}
      <div style={{ background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color, #f1f5f9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.95rem' }}>
            Appointments List ({filteredRecords.length})
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: '#64748b' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Date & Time</th>
                <th style={{ padding: '0.75rem 1rem' }}>Customer</th>
                <th style={{ padding: '0.75rem 1rem' }}>Vehicle</th>
                <th style={{ padding: '0.75rem 1rem' }}>Service Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Technician</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Loading appointments…
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                    No appointments found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((appt) => (
                  <tr key={appt.id} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      <strong>{formatDate(appt.preferredDate)}</strong>
                      <div style={{ color: '#64748b', fontSize: '0.8rem' }}>⏰ {appt.preferredTime}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>{appt.customer}</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{appt.email || appt.mobile}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div>{appt.vehicle}</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem' }}>Plate: {appt.registrationNumber || 'N/A'}</div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div>{appt.serviceType}</div>
                      {appt.problemDescription && (
                        <div style={{ color: '#64748b', fontSize: '0.75rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {appt.problemDescription}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {appt.technician ? (
                        <span style={{ fontWeight: 500 }}>👨‍🔧 {appt.technician}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className={`badge ${getStatusBadgeClass(appt.status)}`}>
                        {serviceStatus(appt.status)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setManagedAppointmentId(appt.id)}
                        className="btn-primary"
                        style={{
                          padding: '0.45rem 0.9rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Manage / Convert
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Booking Modal */}
      {showBookingModal && (
        <SimpleBookingModal
          technicians={technicians}
          onClose={() => setShowBookingModal(false)}
          onCreated={async (result) => {
            setSuccessMessage(
              `Appointment booked successfully for ${result.appointment?.customer || 'Customer'} on ${result.appointment?.preferredDate} at ${result.appointment?.preferredTime}!`
            );
            setShowBookingModal(false);
            await loadAppointments();
          }}
        />
      )}

      {/* Manage Appointment Modal */}
      {managedAppointmentId && (
        <SimpleAppointmentManager
          appointmentId={managedAppointmentId}
          technicians={technicians}
          onClose={() => setManagedAppointmentId('')}
          onSaved={async (msg) => {
            setSuccessMessage(msg || 'Appointment updated successfully.');
            setManagedAppointmentId('');
            await loadAppointments();
          }}
          onConverted={async (jobNum) => {
            setSuccessMessage(`Appointment converted to Job ${jobNum}!`);
            setManagedAppointmentId('');
            await loadAppointments();
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   SIMPLE NEW BOOKING MODAL
   ========================================================= */
function SimpleBookingModal({ technicians, onClose, onCreated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState({ customers: [], serviceTypes: [] });

  // Form State
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState('');
  const [isNewVehicle, setIsNewVehicle] = useState(true);

  // New Customer Fields
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerMobile, setNewCustomerMobile] = useState('');

  // New Vehicle Fields
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');

  // Appointment Fields
  const [serviceType, setServiceType] = useState('');
  const [preferredDate, setPreferredDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [problemDescription, setProblemDescription] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Load server data when these effect dependencies change; cleanup below prevents stale work from updating this view.
  useEffect(() => {
    api
      .get('/admin/appointment-options')
      .then(({ data }) => {
        setOptions(data);
        if (data.serviceTypes?.length) setServiceType(data.serviceTypes[0]);
      })
      .catch(() => setError('Unable to load appointment options.'));
  }, []);

  async function handleCustomerChange(id) {
    setCustomerId(id);
    setVehicleId('');
    if (!id) {
      setCustomerVehicles([]);
      setIsNewVehicle(true);
      return;
    }
    try {
      const { data } = await api.get('/admin/appointment-options', { params: { customerId: id } });
      setCustomerVehicles(data.vehicles || []);
      if (data.vehicles?.length > 0) {
        setVehicleId(data.vehicles[0]._id || data.vehicles[0].id);
        setIsNewVehicle(false);
      } else {
        setIsNewVehicle(true);
      }
    } catch {
      setIsNewVehicle(true);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        serviceType,
        preferredDate,
        preferredTime,
        problemDescription,
        internalNotes,
      };

      if (isNewCustomer) {
        payload.newCustomer = {
          name: newCustomerName,
          email: newCustomerEmail,
          mobile: newCustomerMobile,
        };
      } else {
        payload.customerId = customerId;
      }

      if (isNewVehicle || isNewCustomer) {
        payload.newVehicle = {
          make: vehicleMake,
          model: vehicleModel,
          year: vehicleYear ? Number(vehicleYear) : undefined,
          registrationNumber: vehicleReg,
        };
      } else {
        payload.vehicleId = vehicleId;
      }

      // Send the submitted data to the server; the response below determines the success message and local state changes.
      const { data } = await api.post('/admin/appointments', payload);
      await onCreated(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to book appointment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-card, #1e293b)',
          color: 'var(--text-primary, #f8fafc)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>+ Book New Appointment</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-primary, #fff)', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Customer Selection */}
          <div style={{ border: '1px solid var(--border-color, #2c2c32)', background: 'var(--bg-surface, #111114)', borderRadius: '8px', padding: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Customer Details</label>
              <button
                type="button"
                onClick={() => setIsNewCustomer(!isNewCustomer)}
                style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
              >
                {isNewCustomer ? '← Choose Existing Customer' : '+ Add New Customer'}
              </button>
            </div>

            {isNewCustomer ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <input
                    required
                    type="text"
                    placeholder="Customer Name *"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <input
                    required
                    type="email"
                    placeholder="Email *"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    placeholder="Mobile"
                    value={newCustomerMobile}
                    onChange={(e) => setNewCustomerMobile(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <select
                  required
                  value={customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                >
                  <option value="">Select Existing Customer...</option>
                  {(options.customers || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Vehicle Selection */}
          <div style={{ border: '1px solid var(--border-color, #2c2c32)', background: 'var(--bg-surface, #111114)', borderRadius: '8px', padding: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Vehicle Information</label>
              {!isNewCustomer && customerVehicles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsNewVehicle(!isNewVehicle)}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                >
                  {isNewVehicle ? '← Choose Existing Vehicle' : '+ Add New Vehicle'}
                </button>
              )}
            </div>

            {isNewVehicle || isNewCustomer ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <div>
                  <input
                    required
                    type="text"
                    placeholder="Make (e.g. Toyota) *"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <input
                    required
                    type="text"
                    placeholder="Model (e.g. Corolla) *"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Year (e.g. 2022)"
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <input
                    required
                    type="text"
                    placeholder="Plate / Reg Number *"
                    value={vehicleReg}
                    onChange={(e) => setVehicleReg(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                  />
                </div>
              </div>
            ) : (
              <div>
                <select
                  required
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                >
                  {customerVehicles.map((v) => (
                    <option key={v._id || v.id} value={v._id || v.id}>
                      {v.make} {v.model} ({v.registrationNumber})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Service & Date/Time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Service Type</label>
              <select
                required
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
              >
                {(options.serviceTypes || []).map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date</label>
              <input
                required
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Time</label>
              <input
                required
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Problem Description / Customer Request
            </label>
            <textarea
              rows="2"
              placeholder="Describe customer's issues or requested service details..."
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Internal Notes (Staff Only)
            </label>
            <textarea
              rows="2"
              placeholder="Staff notes..."
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.6rem 1.2rem', background: '#27272a', color: '#f4f4f5', border: '1px solid #52525b', borderRadius: '6px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ padding: '0.6rem 1.5rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer' }}
            >
              {loading ? 'Booking…' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   SIMPLE APPOINTMENT MANAGER MODAL
   ========================================================= */
function SimpleAppointmentManager({ appointmentId, technicians, onClose, onSaved, onConverted }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [appt, setAppt] = useState(null);

  // Editable fields
  const [status, setStatus] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Load server data when these effect dependencies change; cleanup below prevents stale work from updating this view.
  useEffect(() => {
    api
      .get(`/admin/appointments/${appointmentId}`)
      .then(({ data }) => {
        setAppt(data);
        setStatus(data.status || 'Pending');
        setTechnicianId(data.technicianId || '');
        setPreferredDate(data.preferredDate || '');
        setPreferredTime(data.preferredTime || '');
        setServiceType(data.serviceType || '');
        setInternalNotes(data.internalNotes || '');
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Unable to load appointment.');
        setLoading(false);
      });
  }, [appointmentId]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      // Request a server-side change; update the displayed state from the successful response below.
      await api.patch(`/admin/appointments/${appointmentId}`, {
        status,
        technicianId: technicianId || null,
        preferredDate,
        preferredTime,
        serviceType,
        internalNotes,
      });
      onSaved('Appointment saved successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update appointment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConvertToJob() {
    setSaving(true);
    setError('');
    try {
      // First save any edits
      await api.patch(`/admin/appointments/${appointmentId}`, {
        status: 'Confirmed',
        technicianId: technicianId || null,
        preferredDate,
        preferredTime,
        serviceType,
        internalNotes,
      });
      // Convert to job
      const { data } = await api.post(`/admin/appointments/${appointmentId}/convert-to-job`, {
        technicianId: technicianId || undefined,
        priority: 'Normal',
      });
      onConverted(data.serviceNumber || 'Created');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to convert to service job.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-card, #1e293b)',
          color: 'var(--text-primary, #f8fafc)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              {appt?.appointmentNumber || 'Appointment Details'}
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>Manage scheduling and status</span>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-primary, #fff)', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b' }}>Loading details…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Customer & Vehicle Info Box */}
            <div style={{ background: 'var(--bg-surface, #111114)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '8px', padding: '0.85rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary, #b3b3bc)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Customer</span>
                  <div style={{ fontWeight: 600 }}>{appt?.customer?.name || appt?.customer}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #b3b3bc)' }}>{appt?.customer?.email || appt?.customer?.mobile}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary, #b3b3bc)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}>Vehicle</span>
                  <div style={{ fontWeight: 600 }}>{appt?.vehicle?.make} {appt?.vehicle?.model}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #b3b3bc)' }}>Plate: {appt?.vehicle?.registrationNumber || 'N/A'}</div>
                </div>
              </div>
            </div>

            {/* Editable Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {serviceStatus(st)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Assigned Technician</label>
                <select
                  value={technicianId}
                  onChange={(e) => setTechnicianId(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                >
                  <option value="">Unassigned</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Date</label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Time</label>
                <input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Service Type</label>
              <input
                type="text"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
              />
            </div>

            {appt?.problemDescription && (
              <div>
                <span style={{ color: 'var(--text-secondary, #b3b3bc)', fontSize: '0.8rem', fontWeight: 600 }}>Customer Complaint:</span>
                <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', padding: '0.5rem', borderRadius: '6px' }}>
                  {appt.problemDescription}
                </p>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Internal Notes</label>
              <textarea
                rows="2"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-input, #1d1d22)', color: 'var(--text-primary, #f4f4f5)', border: '1px solid var(--border-color, #2c2c32)', borderRadius: '6px' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color, #2c2c32)' }}>
              <button
                type="button"
                onClick={handleConvertToJob}
                disabled={saving || appt?.status === 'Cancelled'}
                style={{
                  padding: '0.55rem 1rem',
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                ⚙ Convert to Job
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ padding: '0.55rem 1rem', background: '#27272a', color: '#f4f4f5', border: '1px solid #52525b', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary"
                  style={{ padding: '0.55rem 1.2rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer' }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
