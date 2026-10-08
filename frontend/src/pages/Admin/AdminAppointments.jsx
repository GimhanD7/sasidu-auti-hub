import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import './AdminAppointments.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const dateKey = date => date.toISOString().slice(0, 10);
const addDays = (date, count) => new Date(date.getTime() + count * DAY_MS);
const startOfWeek = date => addDays(date, -((date.getUTCDay() + 6) % 7));
const dayLabel = date => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
const fullDate = date => new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: 'UTC' }).format(date);
const monthLabel = date => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
const statusClass = status => status.toLowerCase().replaceAll(' ', '-');
const STATUSES = ['Pending', 'Confirmed', 'Checked In', 'In Service', 'Completed', 'Cancelled'];

function visibleRange(date, view) {
  if (view === 'day') return { start: date, end: addDays(date, 1) };
  if (view === 'week') {
    const start = startOfWeek(date);
    return { start, end: addDays(start, 7) };
  }
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 7);
  return { start, end };
}

export default function AdminAppointments() {
  const [view, setView] = useState('week');
  const [selectedDate, setSelectedDate] = useState(() => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`));
  const [statusFilter, setStatusFilter] = useState('');
  const [technicianFilter, setTechnicianFilter] = useState('');
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');
  const [managedAppointmentId, setManagedAppointmentId] = useState('');

  const range = useMemo(() => visibleRange(selectedDate, view), [selectedDate, view]);
  const loadAppointments = useCallback(async () => {
    try {
      const params = { start: range.start.toISOString(), end: range.end.toISOString() };
      if (statusFilter) params.status = statusFilter;
      if (technicianFilter) params.technician = technicianFilter;
      const { data } = await api.get('/admin/appointments', { params });
      setRecords(data.appointments);
      setTechnicians(data.technicians);
      setAvailability(data.availability || []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load appointments. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [range, statusFilter, technicianFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const params = { start: range.start.toISOString(), end: range.end.toISOString() };
    if (statusFilter) params.status = statusFilter;
    if (technicianFilter) params.technician = technicianFilter;
    api.get('/admin/appointments', { params, signal: controller.signal }).then(({ data }) => {
      setRecords(data.appointments); setTechnicians(data.technicians); setAvailability(data.availability || []); setError('');
    }).catch(requestError => {
      if (!controller.signal.aborted) setError(requestError.response?.data?.message || 'Unable to load appointments. Please try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [range, statusFilter, technicianFilter]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter(item => [item.reference, item.customer, item.email, item.vehicle, item.registrationNumber, item.serviceType, item.technician, item.status]
      .some(value => value?.toLowerCase().includes(query)));
  }, [records, search]);

  const days = useMemo(() => {
    if (view === 'day') return [selectedDate];
    const count = view === 'week' ? 7 : Math.round((range.end - range.start) / DAY_MS);
    return Array.from({ length: count }, (_, index) => addDays(range.start, index));
  }, [range, selectedDate, view]);

  function movePeriod(amount) {
    if (view === 'day') setSelectedDate(current => addDays(current, amount));
    else if (view === 'week') setSelectedDate(current => addDays(current, amount * 7));
    else setSelectedDate(current => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + amount, 1)));
  }

  function periodLabel() {
    if (view === 'month') return monthLabel(selectedDate);
    if (view === 'day') return fullDate(selectedDate);
    return `${dayLabel(range.start)} – ${dayLabel(addDays(range.end, -1))}`;
  }

  function appointmentsForDay(day) {
    const key = dateKey(day);
    return filteredRecords.filter(item => dateKey(new Date(item.preferredDate)) === key)
      .sort((a, b) => a.preferredTime.localeCompare(b.preferredTime));
  }

  function availabilityForDay(day) {
    return availability.find(item => item.date === dateKey(day));
  }

  async function saveManagedAppointment() {
    setManagedAppointmentId('');
    await loadAppointments();
  }

  function appointmentCard(item, compact = false) {
    return <article className={`calendar-appointment ${compact ? 'compact' : ''}`} key={item.id}>
      <strong>{item.preferredTime} · {item.serviceType}</strong>
      <span>{item.customer} · {item.vehicle}</span>
      <span>{item.registrationNumber} · {item.reference}</span>
      <span>Tech: {item.technician}</span>
      {item.overlap && <span className="calendar-overlap" role="alert">Time conflict: another active booking uses this slot</span>}
      <span className={`calendar-status ${statusClass(item.status)}`}>{item.status}</span>
      <button type="button" className="calendar-manage-button" onClick={() => setManagedAppointmentId(item.id)}>Manage</button>
    </article>;
  }

  return <div className="admin-appointments">
    <header className="appointment-page-header"><div><h1 className="page-title">Appointment Calendar</h1><p className="page-subtitle">Browse and filter workshop bookings by date, status, technician, or customer details.</p></div>
      <div className="appointment-header-actions"><button className="appointment-new-booking" onClick={() => { setBookingMessage(''); setShowBookingForm(true); }}>+ New booking</button><button className="appointment-refresh" onClick={() => { setLoading(true); loadAppointments(); }} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button></div></header>

    {bookingMessage && <p className="appointment-success" role="status">{bookingMessage}</p>}
    {showBookingForm && <AdminAppointmentForm onClose={() => setShowBookingForm(false)} onCreated={async result => {
      const notices = [result.notificationCreated ? 'Customer notified in the app.' : 'Appointment saved, but the in-app notification could not be saved.'];
      if (result.accountSetupEmailSent) notices.push('Account setup email sent to the new customer.');
      else if (result.newCustomer) notices.push('Configure SMTP to email the new customer an account setup link.');
      setBookingMessage(`${result.appointment.appointmentNumber} booked for ${result.appointment.customer} on ${result.appointment.preferredDate} at ${result.appointment.preferredTime}. ${notices.join(' ')}`);
      setShowBookingForm(false);
      await loadAppointments();
    }} />}
    {managedAppointmentId && <AdminAppointmentManager appointmentId={managedAppointmentId} technicians={technicians} onClose={() => setManagedAppointmentId('')} onSaved={saveManagedAppointment} onConverted={async result => {
      setBookingMessage(`Appointment converted to service job ${result.serviceNumber}.`);
      setManagedAppointmentId('');
      await loadAppointments();
    }} />}

    <section className="appointment-controls" aria-label="Calendar controls">
      <div className="appointment-period-controls"><button aria-label="Previous period" onClick={() => { setLoading(true); movePeriod(-1); }}>‹</button><button onClick={() => { setLoading(true); setSelectedDate(new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)); }}>Today</button><button aria-label="Next period" onClick={() => { setLoading(true); movePeriod(1); }}>›</button><h2>{periodLabel()}</h2></div>
      <div className="appointment-view-switch" role="group" aria-label="Calendar view">{['day', 'week', 'month'].map(option => <button key={option} className={view === option ? 'selected' : ''} aria-pressed={view === option} onClick={() => { setLoading(true); setView(option); }}>{option[0].toUpperCase() + option.slice(1)}</button>)}</div>
    </section>

    <section className="appointment-filters" aria-label="Search and filter appointments">
      <label>Search<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Customer, vehicle, plate, service…" /></label>
      <label>Status<select value={statusFilter} onChange={event => { setLoading(true); setStatusFilter(event.target.value); }}><option value="">All statuses</option>{STATUSES.map(status => <option key={status}>{status}</option>)}</select></label>
      <label>Technician<select value={technicianFilter} onChange={event => { setLoading(true); setTechnicianFilter(event.target.value); }}><option value="">All technicians</option>{technicians.map(technician => <option key={technician.id} value={technician.id}>{technician.name}</option>)}</select></label>
    </section>

    {error && <div className="appointment-error" role="alert"><span>{error}</span><button onClick={() => { setLoading(true); loadAppointments(); }}>Retry</button></div>}
    {loading && <p className="appointment-loading" role="status">Loading appointments…</p>}
    {!loading && !error && filteredRecords.length === 0 && <p className="appointment-empty">No appointments match this period and filter selection.</p>}

    {view === 'day' && <section className="appointment-day-view"><h2>{fullDate(selectedDate)}</h2><p className="appointment-capacity">Capacity: {availabilityForDay(selectedDate)?.capacity || 0} slots · {availabilityForDay(selectedDate)?.bookedCount || 0} booked · {availabilityForDay(selectedDate)?.slots.filter(slot => slot.status === 'Available').length || 0} open · {availabilityForDay(selectedDate)?.overlapCount || 0} slot conflicts</p>{appointmentsForDay(selectedDate).length ? appointmentsForDay(selectedDate).map(item => appointmentCard(item)) : <p className="appointment-empty">No appointments for this day.</p>}<h3>Appointment slots</h3>{availabilityForDay(selectedDate)?.closed ? <p className="calendar-no-bookings">Workshop closed</p> : <div className="appointment-slot-list">{(availabilityForDay(selectedDate)?.slots || []).map(slot => <span className={`appointment-slot ${statusClass(slot.status)}`} key={slot.time}>{slot.time} · {slot.status}{slot.count > 1 ? ` (${slot.count} bookings)` : ''}</span>)}</div>}</section>}
    {view === 'week' && <section className="appointment-week-grid" aria-label="Weekly appointments">{days.map(day => <div className="appointment-day-column" key={dateKey(day)}><header><strong>{dayLabel(day)}</strong><span>{appointmentsForDay(day).length} bookings · {availabilityForDay(day)?.slots.filter(slot => slot.status === 'Available').length || 0} open / {availabilityForDay(day)?.capacity || 0}</span>{availabilityForDay(day)?.overlapCount > 0 && <em className="calendar-overlap">{availabilityForDay(day).overlapCount} slot conflict(s)</em>}</header>{appointmentsForDay(day).length ? appointmentsForDay(day).map(item => appointmentCard(item, true)) : <p className="calendar-no-bookings">No bookings</p>}</div>)}</section>}
    {view === 'month' && <section className="appointment-month-grid" aria-label="Monthly appointments"><div className="month-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <strong key={day}>{day}</strong>)}</div><div className="month-days">{days.map(day => <div className={`month-day ${day.getUTCMonth() !== selectedDate.getUTCMonth() ? 'outside-month' : ''}`} key={dateKey(day)}><strong>{day.getUTCDate()}</strong>{appointmentsForDay(day).slice(0, 3).map(item => <button type="button" className={`month-event ${statusClass(item.status)} ${item.overlap ? 'overlap' : ''}`} key={item.id} title={item.overlap ? 'Time conflict with another active booking' : item.reference} onClick={() => setManagedAppointmentId(item.id)}><time>{item.preferredTime}</time> {item.customer} · {item.serviceType}</button>)}{appointmentsForDay(day).length > 3 && <small>+{appointmentsForDay(day).length - 3} more</small>}<small className="month-open-slots">{availabilityForDay(day)?.slots.filter(slot => slot.status === 'Available').length || 0} open / {availabilityForDay(day)?.capacity || 0} slots{availabilityForDay(day)?.overlapCount ? ` · ${availabilityForDay(day).overlapCount} conflict` : ''}</small></div>)}</div></section>}
  </div>;
}

function AdminAppointmentForm({ onClose, onCreated }) {
  const [dateLimits] = useState(() => {
    const now = new Date();
    return { today: now.toISOString().slice(0, 10), lastDate: new Date(now.getTime() + 30 * DAY_MS).toISOString().slice(0, 10), currentYear: now.getUTCFullYear() };
  });
  const { today, lastDate, currentYear } = dateLimits;
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [slots, setSlots] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [newVehicleMode, setNewVehicleMode] = useState(true);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', mobile: '' });
  const [newVehicle, setNewVehicle] = useState({ make: '', model: '', year: '', registrationNumber: '' });
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/appointment-options').then(({ data }) => {
      setCustomers(data.customers); setServiceTypes(data.serviceTypes);
      setServiceType(data.serviceTypes[0] || ''); setOptionsLoading(false);
    }).catch(requestError => {
      setError(requestError.response?.data?.message || 'Unable to load booking options.'); setOptionsLoading(false);
    });
  }, []);

  useEffect(() => {
    const query = customerSearch.trim();
    const timer = setTimeout(() => {
      api.get('/admin/appointment-options', { params: query ? { search: query } : {} })
        .then(({ data }) => setCustomers(data.customers))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    const start = `${date}T00:00:00.000Z`;
    const end = new Date(new Date(start).getTime() + DAY_MS).toISOString();
    const controller = new AbortController();
    api.get('/admin/appointments', { params: { start, end }, signal: controller.signal }).then(({ data }) => {
      const day = data.availability?.[0];
      setSlots(day?.slots || []);
      setTime(current => day?.slots.some(slot => slot.time === current && slot.status === 'Available') ? current : day?.slots.find(slot => slot.status === 'Available')?.time || '');
    }).catch(() => { if (!controller.signal.aborted) setSlots([]); }).finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false); });
    return () => controller.abort();
  }, [date]);

  async function chooseCustomer(nextId) {
    setCustomerId(nextId); setVehicleId(''); setVehicles([]);
    if (!nextId) return;
    try {
      const { data } = await api.get('/admin/appointment-options', { params: { customerId: nextId } });
      setVehicles(data.vehicles); setNewVehicleMode(data.vehicles.length === 0);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load this customer’s vehicles.'); }
  }

  async function submit(event) {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = {
        ...(newCustomerMode ? { newCustomer } : { customerId }),
        ...(newVehicleMode ? { newVehicle } : { vehicleId }),
        serviceType, preferredDate: date, preferredTime: time, problemDescription, customerNotes, internalNotes,
      };
      const { data } = await api.post('/admin/appointments', payload);
      await onCreated(data);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to create this appointment.'); }
    finally { setLoading(false); }
  }

  const availableSlots = slots.filter(slot => slot.status === 'Available');
  return <div className="appointment-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="appointment-modal" role="dialog" aria-modal="true" aria-labelledby="appointment-form-title">
      <header><div><h2 id="appointment-form-title">Create appointment</h2><p>Book a service for a customer and vehicle.</p></div><button type="button" className="appointment-modal-close" onClick={onClose} aria-label="Close">×</button></header>
      {error && <p className="appointment-form-error" role="alert">{error}</p>}
      {optionsLoading ? <p role="status">Loading customers and services…</p> : <form onSubmit={submit}>
        <div className="appointment-mode-toggle"><button type="button" className={!newCustomerMode ? 'selected' : ''} onClick={() => setNewCustomerMode(false)}>Existing customer</button><button type="button" className={newCustomerMode ? 'selected' : ''} onClick={() => { setNewCustomerMode(true); setNewVehicleMode(true); }}>Add new customer</button></div>
        {newCustomerMode ? <div className="appointment-form-grid"><label>Customer name<input required minLength="2" maxLength="100" value={newCustomer.name} onChange={event => setNewCustomer({ ...newCustomer, name: event.target.value })} /></label><label>Email<input required type="email" maxLength="254" value={newCustomer.email} onChange={event => setNewCustomer({ ...newCustomer, email: event.target.value })} /></label><label>Mobile number<input required type="tel" value={newCustomer.mobile} onChange={event => setNewCustomer({ ...newCustomer, mobile: event.target.value })} /></label></div> : <div className="appointment-form-grid"><label className="appointment-form-wide">Search customers<input type="search" placeholder="Name, email or mobile" value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} /></label><label className="appointment-form-wide">Customer<select required value={customerId} onChange={event => chooseCustomer(event.target.value)}><option value="">Select a customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} · {customer.email} · {customer.mobile}</option>)}</select></label></div>}

        <div className="appointment-mode-toggle"><button type="button" className={!newVehicleMode ? 'selected' : ''} disabled={newCustomerMode || vehicles.length === 0} onClick={() => setNewVehicleMode(false)}>Existing vehicle</button><button type="button" className={newVehicleMode ? 'selected' : ''} onClick={() => setNewVehicleMode(true)}>Add vehicle</button></div>
        {!newVehicleMode && <label className="appointment-form-wide appointment-form-block">Vehicle<select required value={vehicleId} onChange={event => setVehicleId(event.target.value)}><option value="">Select a vehicle</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber} · {vehicle.year ? `${vehicle.year} ` : ''}{vehicle.make} {vehicle.model}</option>)}</select></label>}
        {newVehicleMode && <div className="appointment-form-grid"><label>Make<input required maxLength="80" value={newVehicle.make} onChange={event => setNewVehicle({ ...newVehicle, make: event.target.value })} /></label><label>Model<input required maxLength="80" value={newVehicle.model} onChange={event => setNewVehicle({ ...newVehicle, model: event.target.value })} /></label><label>Registration number<input required maxLength="32" value={newVehicle.registrationNumber} onChange={event => setNewVehicle({ ...newVehicle, registrationNumber: event.target.value })} /></label><label>Year<input type="number" min="1886" max={currentYear + 1} value={newVehicle.year} onChange={event => setNewVehicle({ ...newVehicle, year: event.target.value })} /></label></div>}

        <div className="appointment-form-grid"><label>Service<select required value={serviceType} onChange={event => setServiceType(event.target.value)}>{serviceTypes.map(service => <option key={service}>{service}</option>)}</select></label><label>Date<input required type="date" min={today} max={lastDate} value={date} onChange={event => { setAvailabilityLoading(true); setDate(event.target.value); }} /></label><label>Time<select required value={time} onChange={event => setTime(event.target.value)} disabled={availabilityLoading || !availableSlots.length}><option value="">{availabilityLoading ? 'Checking availability…' : availableSlots.length ? 'Select an open slot' : 'No slots available'}</option>{availableSlots.map(slot => <option key={slot.time} value={slot.time}>{slot.time}</option>)}</select></label></div>
        {!availabilityLoading && <p className="appointment-availability-message" role="status">{availableSlots.length} available slot{availableSlots.length === 1 ? '' : 's'} for this date. The server checks again when you confirm.</p>}
        <label className="appointment-form-block">Customer complaint<textarea required minLength="1" maxLength="1000" rows="3" value={problemDescription} onChange={event => setProblemDescription(event.target.value)} /></label>
        <label className="appointment-form-block">Customer notes<textarea maxLength="1000" rows="2" value={customerNotes} onChange={event => setCustomerNotes(event.target.value)} /></label>
        <label className="appointment-form-block">Internal notes (staff only)<textarea maxLength="1000" rows="2" value={internalNotes} onChange={event => setInternalNotes(event.target.value)} /></label>
        <footer><button type="button" className="appointment-refresh" onClick={onClose} disabled={loading}>Cancel</button><button className="appointment-new-booking" type="submit" disabled={loading || availabilityLoading || !time || (!newCustomerMode && !customerId) || (!newVehicleMode && !vehicleId)}>{loading ? 'Booking…' : 'Confirm booking'}</button></footer>
      </form>}
    </section>
  </div>;
}

function AdminAppointmentManager({ appointmentId, technicians, onClose, onSaved, onConverted }) {
  const [record, setRecord] = useState(null);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [slots, setSlots] = useState([]);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [jobPriority, setJobPriority] = useState('Normal');
  const [expectedCompletionTime, setExpectedCompletionTime] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.get(`/admin/appointments/${appointmentId}`), api.get('/admin/appointment-options')]).then(([appointmentResponse, optionsResponse]) => {
      if (!active) return;
      setRecord({ ...appointmentResponse.data, originalPreferredDate: appointmentResponse.data.preferredDate, originalPreferredTime: appointmentResponse.data.preferredTime });
      setServiceTypes(optionsResponse.data.serviceTypes);
    }).catch(requestError => { if (active) setError(requestError.response?.data?.message || 'Unable to load appointment details.'); });
    return () => { active = false; };
  }, [appointmentId]);

  const preferredDate = record?.preferredDate;
  useEffect(() => {
    if (!preferredDate) return undefined;
    const start = `${preferredDate}T00:00:00.000Z`;
    const end = new Date(new Date(start).getTime() + DAY_MS).toISOString();
    const controller = new AbortController();
    api.get('/admin/appointments', { params: { start, end }, signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) {
        const nextSlots = data.availability?.[0]?.slots || [];
        setSlots(nextSlots);
        setRecord(current => {
          if (!current || current.preferredDate !== preferredDate) return current;
          if (nextSlots.some(slot => slot.time === current.preferredTime && (slot.status === 'Available' || current.preferredDate === current.originalPreferredDate))) return current;
          return { ...current, preferredTime: nextSlots.find(slot => slot.status === 'Available')?.time || '' };
        });
      }
    }).catch(() => { if (!controller.signal.aborted) setSlots([]); }).finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false); });
    return () => controller.abort();
  }, [preferredDate]);

  function update(field, value) { setRecord(current => ({ ...current, [field]: value })); }
  async function save(changes = {}) {
    setSaving(true); setError('');
    try {
      const body = {
        serviceType: record.serviceType, problemDescription: record.problemDescription,
        customerNotes: record.customerNotes, internalNotes: record.internalNotes,
        technicianId: record.technicianId, status: record.status, ...changes,
      };
      if (record.preferredDate !== record.originalPreferredDate || record.preferredTime !== record.originalPreferredTime) {
        body.preferredDate = record.preferredDate; body.preferredTime = record.preferredTime;
      }
      await api.patch(`/admin/appointments/${appointmentId}`, body);
      await onSaved();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save appointment changes.'); }
    finally { setSaving(false); }
  }
  async function convertToJob() {
    setSaving(true); setError('');
    try {
      const appointmentChanges = {
        serviceType: record.serviceType, problemDescription: record.problemDescription,
        customerNotes: record.customerNotes, internalNotes: record.internalNotes,
        technicianId: record.technicianId, status: record.status,
      };
      if (record.preferredDate !== record.originalPreferredDate || record.preferredTime !== record.originalPreferredTime) {
        appointmentChanges.preferredDate = record.preferredDate; appointmentChanges.preferredTime = record.preferredTime;
      }
      await api.patch(`/admin/appointments/${appointmentId}`, appointmentChanges);
      const { data } = await api.post(`/admin/appointments/${appointmentId}/convert-to-job`, { technicianId: record.technicianId, priority: jobPriority, expectedCompletionTime: expectedCompletionTime ? new Date(expectedCompletionTime).toISOString() : '', customerComplaint: record.problemDescription });
      await onConverted(data);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to create a service job.'); }
    finally { setSaving(false); }
  }

  if (!record) return <div className="appointment-modal-backdrop"><section className="appointment-modal" role="dialog" aria-modal="true"><button className="appointment-modal-close" onClick={onClose}>×</button><p role={error ? 'alert' : 'status'}>{error || 'Loading appointment…'}</p></section></div>;
  const currentTimeAvailable = record.preferredDate === record.originalPreferredDate && record.preferredTime && slots.some(slot => slot.time === record.preferredTime && slot.status === 'Booked');
  const selectableTimes = slots.filter(slot => slot.status === 'Available' || (slot.time === record.preferredTime && currentTimeAvailable));
  return <div className="appointment-modal-backdrop"><section className="appointment-modal appointment-manager" role="dialog" aria-modal="true" aria-labelledby="manage-appointment-title">
    <header><div><h2 id="manage-appointment-title">Manage {record.appointmentNumber}</h2><p>{record.customer?.name} · {record.vehicle?.registrationNumber} · {record.vehicle?.make} {record.vehicle?.model}</p></div><button type="button" className="appointment-modal-close" onClick={onClose} aria-label="Close">×</button></header>
    <div className="appointment-contact-details"><span>{record.customer?.email}</span><span>{record.customer?.mobile}</span><span>VIN: {record.vehicle?.vinNumber || 'Not recorded'}</span></div>
    {record.rescheduleRequest && <p className="appointment-form-error">Customer requested {record.rescheduleRequest.preferredDate} at {record.rescheduleRequest.preferredTime}{record.rescheduleRequest.notes ? ` — ${record.rescheduleRequest.notes}` : ''}. Update the date and time below to approve.</p>}
    {record.serviceJob && <p className="appointment-success">Service job {record.serviceJob.serviceNumber} · {record.serviceJob.status}</p>}
    {error && <p className="appointment-form-error" role="alert">{error}</p>}
    <div className="appointment-form-grid">
      <label>Status<select value={record.status} onChange={event => update('status', event.target.value)}>{STATUSES.map(status => <option key={status}>{status}</option>)}</select></label>
      <label>Service<select value={record.serviceType} onChange={event => update('serviceType', event.target.value)}>{!serviceTypes.includes(record.serviceType) && <option value={record.serviceType}>{record.serviceType} (inactive)</option>}{serviceTypes.map(service => <option key={service}>{service}</option>)}</select></label>
      <label>Date<input type="date" value={record.preferredDate} min={today} onChange={event => { setAvailabilityLoading(true); update('preferredDate', event.target.value); }} /></label>
      <label>Time<select value={record.preferredTime} disabled={availabilityLoading} onChange={event => update('preferredTime', event.target.value)}>{selectableTimes.map(slot => <option key={slot.time} value={slot.time}>{slot.time}{slot.status === 'Booked' ? ' (current booking)' : ''}</option>)}</select></label>
      <label className="appointment-form-wide">Assign technician<select value={record.technicianId || ''} onChange={event => update('technicianId', event.target.value)}><option value="">Unassigned</option>{technicians.map(person => <option key={person.id} value={person.id} disabled={person.availabilityStatus !== 'Available' && record.technicianId !== person.id}>{person.name}{person.availabilityStatus !== 'Available' ? ` · ${person.availabilityStatus}` : ''}</option>)}</select></label>
    </div>
    <label className="appointment-form-block">Customer complaint<textarea rows="3" maxLength="1000" value={record.problemDescription} onChange={event => update('problemDescription', event.target.value)} /></label>
    {!record.serviceJob && <div className="appointment-form-grid job-creation-options"><label>Initial job priority<select value={jobPriority} onChange={event => setJobPriority(event.target.value)}>{['Low', 'Normal', 'High', 'Urgent'].map(priority => <option key={priority}>{priority}</option>)}</select></label><label>Expected completion<input type="datetime-local" value={expectedCompletionTime} onChange={event => setExpectedCompletionTime(event.target.value)} /></label></div>}
    <label className="appointment-form-block">Customer notes<textarea rows="2" maxLength="1000" value={record.customerNotes} onChange={event => update('customerNotes', event.target.value)} /></label>
    <label className="appointment-form-block">Internal notes (staff only)<textarea rows="2" maxLength="1000" value={record.internalNotes} onChange={event => update('internalNotes', event.target.value)} /></label>
    <footer className="appointment-manager-actions"><button type="button" className="appointment-refresh" onClick={() => save({ status: 'Checked In' })} disabled={saving || record.status === 'Cancelled' || record.status === 'Completed'}>Mark arrived</button><span />{!record.serviceJob && <button type="button" className="appointment-new-booking" onClick={convertToJob} disabled={saving || !['Confirmed', 'Checked In'].includes(record.status)}>Convert to job</button>}<button type="button" className="appointment-new-booking" onClick={() => save()} disabled={saving || availabilityLoading}>{saving ? 'Saving…' : 'Save changes'}</button></footer>
  </section></div>;
}
