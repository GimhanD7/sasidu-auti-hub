import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import './CustomerAppointments.css';

const RANGE_DAYS = 14;
const localDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shiftDate = (key, days) => {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};
const dateLabel = key => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${key}T12:00:00`));
const longDate = key => new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date(`${key}T12:00:00`));
const TODAY_LOCAL_DATE = localDateKey(new Date());

export default function CustomerAppointments() {
  const today = TODAY_LOCAL_DATE;
  const [rangeStart, setRangeStart] = useState(today);
  const [options, setOptions] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [dates, setDates] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [formError, setFormError] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const [availabilityRetry, setAvailabilityRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api.get('/appointments/options', { signal: controller.signal }), api.get('/vehicles', { signal: controller.signal })])
      .then(([optionResponse, vehicleResponse]) => {
        if (controller.signal.aborted) return;
        setOptions(optionResponse.data);
        setVehicles(vehicleResponse.data);
        setSelectedVehicle(previous => previous || vehicleResponse.data[0]?._id || vehicleResponse.data[0]?.id || '');
        setServiceType(previous => previous || optionResponse.data.serviceTypes[0] || '');
        setLoadError('');
      })
      .catch(error => { if (!controller.signal.aborted) setLoadError(error.response?.data?.message || 'Unable to load booking options. Please try again.'); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (!options) return undefined;
    const controller = new AbortController();
    api.get('/appointments/availability', { params: { from: rangeStart, days: RANGE_DAYS }, signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setDates(data.dates || []);
        setSelectedDate(previous => data.dates?.some(day => day.date === previous && day.available)
          ? previous
          : data.dates?.find(day => day.available)?.date || data.dates?.[0]?.date || '');
      })
      .catch(error => { if (!controller.signal.aborted) { setDates([]); setAvailabilityError(error.response?.data?.message || 'Unable to load available dates. Please try again.'); } });
    return () => controller.abort();
  }, [options, rangeStart, availabilityRetry]);

  const selectedDay = dates.find(day => day.date === selectedDate);
  const selectedVehicleDetails = vehicles.find(vehicle => String(vehicle._id || vehicle.id) === selectedVehicle);
  const lastBookableRangeStart = shiftDate(today, RANGE_DAYS);

  function changeDate(date) { setSelectedDate(date); setSelectedTime(''); setFormError(''); }
  function selectRange(next) {
    if (next < today || next > lastBookableRangeStart) return;
    setRangeStart(next);
    setSelectedTime('');
    setAvailabilityError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (booking) return;
    setBooking(true);
    setFormError('');
    try {
      const { data } = await api.post('/appointments', {
        vehicleId: selectedVehicle,
        serviceType,
        preferredDate: selectedDate,
        preferredTime: selectedTime,
        problemDescription,
        customerNotes,
      });
      setBookingResult(data);
      setAvailabilityError('');
    } catch (error) {
      setFormError(error.response?.data?.message || 'Unable to book this appointment. Please try again.');
      if (error.response?.status === 409) { setSelectedTime(''); setAvailabilityRetry(value => value + 1); }
    } finally { setBooking(false); }
  }

  function startAnotherBooking() {
    setBookingResult(null);
    setProblemDescription('');
    setCustomerNotes('');
    setSelectedTime('');
    setRangeStart(today);
  }

  if (loadError) return <div className="appointments-page"><h1 className="page-title">Book a service appointment</h1><div className="appointment-message error" role="alert"><p>{loadError}</p><button className="btn-outline" onClick={() => setRetry(value => value + 1)} type="button">Try again</button></div></div>;
  if (!options) return <div className="appointments-page" role="status"><h1 className="page-title">Book a service appointment</h1><p className="page-subtitle">Loading vehicles and booking options…</p></div>;

  if (bookingResult) {
    const { appointment, notificationCreated } = bookingResult;
    return <div className="appointments-page">
      <div className="appointment-success" role="status" aria-live="polite"><span className="appointment-success-icon" aria-hidden="true">✓</span><span className="appointment-eyebrow">BOOKING REQUEST RECEIVED</span><h1>Appointment submitted</h1><p>Your request is recorded. The workshop will review it and update its status.</p>
        <dl><div><dt>Appointment ID</dt><dd>{appointment.appointmentNumber}</dd></div><div><dt>Service</dt><dd>{appointment.serviceType}</dd></div><div><dt>Vehicle</dt><dd>{appointment.vehicle.make} {appointment.vehicle.model} · {appointment.vehicle.registrationNumber}</dd></div><div><dt>Date and time</dt><dd>{longDate(appointment.preferredDate)} · {appointment.preferredTime}</dd></div><div><dt>Status</dt><dd><span className="appointment-pending-pill">{appointment.status}</span></dd></div></dl>
        <p className="appointment-notice">{notificationCreated ? 'A confirmation notification has been added to your account.' : 'Your booking is saved. The in-app notification could not be created, but you can see the appointment details above.'}</p>
        <div className="appointment-success-actions"><Link className="btn-outline" to="/customer/dashboard">Back to dashboard</Link><button className="btn-primary" type="button" onClick={startAnotherBooking}>Book another appointment</button></div>
      </div>
    </div>;
  }

  if (!vehicles.length) return <div className="appointments-page"><h1 className="page-title">Book a service appointment</h1><section className="appointment-empty"><h2>Add a vehicle first</h2><p>Appointments need to be linked to a vehicle registered to your account.</p><Link className="btn-primary" to="/customer/vehicles">Manage my vehicles</Link></section></div>;

  return <div className="appointments-page">
    <header className="appointments-header"><div><span className="appointment-eyebrow">CUSTOMER PORTAL</span><h1 className="page-title">Book a service appointment</h1><p className="page-subtitle">Choose a vehicle and an available time. Your booking will be sent to the workshop for confirmation.</p></div></header>
    <div className="appointment-step-list" aria-label="Booking steps"><span className="active"><b>1</b> Service details</span><i aria-hidden="true" /><span className={selectedDate && selectedTime ? 'active' : ''}><b>2</b> Date and time</span><i aria-hidden="true" /><span><b>3</b> Confirm</span></div>
    <form className="appointment-form" onSubmit={submit}>
      <section className="appointment-section"><div className="appointment-section-title"><span>01</span><div><h2>Service details</h2><p>Tell us which vehicle needs work and what service you need.</p></div></div>
        <div className="appointment-form-grid"><label className="appointment-field">Vehicle<select required value={selectedVehicle} onChange={event => setSelectedVehicle(event.target.value)}><option value="" disabled>Select your vehicle</option>{vehicles.map(vehicle => { const id = vehicle._id || vehicle.id; return <option value={id} key={id}>{vehicle.make} {vehicle.model} · {vehicle.registrationNumber}</option>; })}</select></label>
          <label className="appointment-field">Service type<select required value={serviceType} onChange={event => setServiceType(event.target.value)}>{options.serviceTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
          <label className="appointment-field appointment-field-wide">What do you need help with? *<textarea required minLength={3} maxLength={1000} rows={4} value={problemDescription} onChange={event => setProblemDescription(event.target.value)} placeholder="Describe the issue, warning light, noise or service needed…" /><small>{problemDescription.length}/1,000 characters</small></label>
          <label className="appointment-field appointment-field-wide">Additional notes <span className="optional-label">Optional</span><textarea maxLength={1000} rows={3} value={customerNotes} onChange={event => setCustomerNotes(event.target.value)} placeholder="Anything else the workshop should know?" /><small>{customerNotes.length}/1,000 characters</small></label>
        </div>
      </section>
      <section className="appointment-section"><div className="appointment-section-title"><span>02</span><div><h2>Choose a date and time</h2><p>Unavailable times are disabled. Slots are held for one booking at a time.</p></div></div>
        <div className="appointment-date-range"><button type="button" className="btn-outline" disabled={rangeStart === today} onClick={() => selectRange(shiftDate(rangeStart, -RANGE_DAYS))}>← Earlier</button><strong>{dates.length ? `${dateLabel(dates[0].date)} – ${dateLabel(dates[dates.length - 1].date)}` : 'Available dates'}</strong><button type="button" className="btn-outline" disabled={rangeStart >= lastBookableRangeStart} onClick={() => selectRange(shiftDate(rangeStart, RANGE_DAYS))}>Later →</button></div>
        {availabilityError && <div className="appointment-message error" role="alert"><p>{availabilityError}</p><button type="button" className="btn-outline" onClick={() => { setAvailabilityError(''); setAvailabilityRetry(value => value + 1); }}>Retry</button></div>}
        {!availabilityError && <><div className="appointment-date-grid" role="group" aria-label="Available dates">{dates.map(day => <button key={day.date} type="button" className={`appointment-date-option ${selectedDate === day.date ? 'selected' : ''}`} disabled={!day.available} aria-pressed={selectedDate === day.date} onClick={() => changeDate(day.date)}><span>{dateLabel(day.date)}</span><small>{day.closed ? 'Workshop closed' : day.available ? `${day.slots.filter(slot => slot.available).length} times available` : 'Fully booked'}</small></button>)}</div>
          <div className="appointment-times"><h3>{selectedDay ? `Available times · ${dateLabel(selectedDay.date)}` : 'Choose a date to view times'}</h3><div className="appointment-time-grid">{selectedDay?.slots.map(slot => <button key={slot.time} type="button" className={`appointment-time-option ${selectedTime === slot.time ? 'selected' : ''}`} disabled={!slot.available} aria-pressed={selectedTime === slot.time} onClick={() => { setSelectedTime(slot.time); setFormError(''); }}>{slot.time}</button>)}</div></div>
        </>}
      </section>
      <section className="appointment-section appointment-review"><div className="appointment-section-title"><span>03</span><div><h2>Review and submit</h2><p>Your request will be created as Pending until the workshop confirms it.</p></div></div>
        <dl className="appointment-review-grid"><div><dt>Vehicle</dt><dd>{selectedVehicleDetails ? `${selectedVehicleDetails.make} ${selectedVehicleDetails.model} · ${selectedVehicleDetails.registrationNumber}` : 'Select a vehicle'}</dd></div><div><dt>Service</dt><dd>{serviceType || 'Select service type'}</dd></div><div><dt>Date</dt><dd>{selectedDate ? longDate(selectedDate) : 'Select an available date'}</dd></div><div><dt>Time</dt><dd>{selectedTime || 'Select an available time'}</dd></div></dl>
        {formError && <p className="appointment-message error" role="alert">{formError}</p>}
        <button className="btn-primary appointment-submit" type="submit" disabled={booking || !selectedVehicle || !serviceType || !selectedDate || !selectedTime || !problemDescription.trim()}>{booking ? 'Submitting request…' : 'Confirm appointment request'}</button>
      </section>
    </form>
    <p className="appointment-back-link"><Link to="/customer/dashboard">Back to dashboard</Link></p>
  </div>;
}
