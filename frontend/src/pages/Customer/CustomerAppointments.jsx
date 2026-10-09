import { serviceStatus } from '../../lib/serviceStatus';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
const RANGE_DAYS = 14;
const localDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shiftDate = (key, days) => {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};
const daysBetween = (start, end) =>
  Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / (24 * 60 * 60 * 1000));
const dateLabel = (key) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(`${key}T12:00:00`),
  );
const longDate = (key) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date(`${key}T12:00:00`));
const TODAY_LOCAL_DATE = localDateKey(new Date());
const isUpcoming = (appointment) =>
  !['Completed', 'Cancelled'].includes(appointment.status) &&
  new Date(`${appointment.preferredDate}T${appointment.preferredTime}:00`).getTime() > Date.now();

export default function CustomerAppointments() {
  const today = TODAY_LOCAL_DATE;
  const [rangeStart, setRangeStart] = useState(today);
  const [rangeLength, setRangeLength] = useState(RANGE_DAYS);
  const finalBookableDate = shiftDate(today, 30);
  const [options, setOptions] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [appointments, setAppointments] = useState(null);
  const [appointmentError, setAppointmentError] = useState('');
  const [appointmentRetry, setAppointmentRetry] = useState(0);
  const [managementMessage, setManagementMessage] = useState('');
  const [managementError, setManagementError] = useState('');
  const [actionId, setActionId] = useState('');
  const [cancelConfirmId, setCancelConfirmId] = useState('');
  const [rescheduleForm, setRescheduleForm] = useState(null);
  const [rescheduleDay, setRescheduleDay] = useState(null);
  const [rescheduleError, setRescheduleError] = useState('');
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
    Promise.all([
      api.get('/appointments/options', { signal: controller.signal }),
      api.get('/vehicles', { signal: controller.signal }),
    ])
      .then(([optionResponse, vehicleResponse]) => {
        if (controller.signal.aborted) return;
        setOptions(optionResponse.data);
        setVehicles(vehicleResponse.data);
        setSelectedVehicle(
          (previous) =>
            previous || vehicleResponse.data[0]?._id || vehicleResponse.data[0]?.id || '',
        );
        setServiceType((previous) => previous || optionResponse.data.serviceTypes[0] || '');
        setLoadError('');
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setLoadError(
            error.response?.data?.message || 'Unable to load booking options. Please try again.',
          );
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/appointments', { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setAppointments(data);
          setAppointmentError('');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setAppointmentError(error.response?.data?.message || 'Unable to load your appointments.');
      });
    return () => controller.abort();
  }, [appointmentRetry]);

  useEffect(() => {
    if (!options) return undefined;
    const controller = new AbortController();
    api
      .get('/appointments/availability', {
        params: { from: rangeStart, days: rangeLength },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setDates(data.dates || []);
        setSelectedDate((previous) =>
          data.dates?.some((day) => day.date === previous && day.available)
            ? previous
            : data.dates?.find((day) => day.available)?.date || data.dates?.[0]?.date || '',
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setDates([]);
          setAvailabilityError(
            error.response?.data?.message || 'Unable to load available dates. Please try again.',
          );
        }
      });
    return () => controller.abort();
  }, [options, rangeStart, rangeLength, availabilityRetry]);

  useEffect(() => {
    if (!rescheduleForm?.date) return undefined;
    const controller = new AbortController();
    api
      .get('/appointments/availability', {
        params: { from: rescheduleForm.date, days: 1, excludeAppointmentId: rescheduleForm.id },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) setRescheduleDay(data.dates?.[0] || null);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setRescheduleError(
            error.response?.data?.message || 'Unable to load times for this date.',
          );
      });
    return () => controller.abort();
  }, [rescheduleForm?.id, rescheduleForm?.date]);

  const selectedDay = dates.find((day) => day.date === selectedDate);
  const selectedVehicleDetails = vehicles.find(
    (vehicle) => String(vehicle._id || vehicle.id) === selectedVehicle,
  );
  const lastBookableRangeStart = shiftDate(today, RANGE_DAYS * 2);

  function changeDate(date) {
    setSelectedDate(date);
    setSelectedTime('');
    setFormError('');
  }
  function selectRange(next) {
    if (next < today || next > lastBookableRangeStart) return;
    setRangeStart(next);
    setRangeLength(Math.min(RANGE_DAYS, daysBetween(next, finalBookableDate) + 1));
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
      setProblemDescription('');
      setCustomerNotes('');
      setSelectedTime('');
      setAppointmentRetry((value) => value + 1);
      setAvailabilityRetry((value) => value + 1);
      setAvailabilityError('');
    } catch (error) {
      setFormError(
        error.response?.data?.message || 'Unable to book this appointment. Please try again.',
      );
      if (error.response?.status === 409) {
        setSelectedTime('');
        setAvailabilityRetry((value) => value + 1);
      }
    } finally {
      setBooking(false);
    }
  }

  function startAnotherBooking() {
    setBookingResult(null);
    setProblemDescription('');
    setCustomerNotes('');
    setSelectedTime('');
    setRangeStart(today);
    setRangeLength(RANGE_DAYS);
  }

  async function cancelAppointment(appointment) {
    setActionId(appointment.id);
    setManagementError('');
    setManagementMessage('');
    try {
      await api.patch(`/appointments/${appointment.id}/cancel`);
      setManagementMessage(`Appointment ${appointment.appointmentNumber} was cancelled.`);
      setCancelConfirmId('');
      setAppointmentRetry((value) => value + 1);
      setAvailabilityRetry((value) => value + 1);
    } catch (error) {
      setManagementError(error.response?.data?.message || 'Unable to cancel this appointment.');
    } finally {
      setActionId('');
    }
  }

  async function submitReschedule(event) {
    event.preventDefault();
    if (!rescheduleForm || actionId) return;
    setActionId(rescheduleForm.id);
    setManagementError('');
    setManagementMessage('');
    setRescheduleError('');
    try {
      const { data } = await api.post(`/appointments/${rescheduleForm.id}/reschedule-request`, {
        preferredDate: rescheduleForm.date,
        preferredTime: rescheduleForm.time,
        notes: rescheduleForm.notes,
      });
      setRescheduleForm(null);
      setRescheduleDay(null);
      setManagementMessage(
        `Reschedule request sent for appointment ${data.appointment.appointmentNumber}. The current booking remains active until the workshop reviews the request.`,
      );
      setAppointmentRetry((value) => value + 1);
    } catch (error) {
      setRescheduleError(error.response?.data?.message || 'Unable to send the reschedule request.');
    } finally {
      setActionId('');
    }
  }

  if (loadError)
    return (
      <div className="appointments-page">
        <h1 className="page-title">Book a service appointment</h1>
        <div className="appointment-message error" role="alert">
          <p>{loadError}</p>
          <button
            className="btn-outline"
            onClick={() => setRetry((value) => value + 1)}
            type="button"
          >
            Try again
          </button>
        </div>
      </div>
    );
  if (!options)
    return (
      <div className="appointments-page" role="status">
        <h1 className="page-title">Book a service appointment</h1>
        <p className="page-subtitle">Loading vehicles and booking options…</p>
      </div>
    );

  const upcomingAppointments = (appointments || []).filter(isUpcoming);
  const pastAppointments = (appointments || []).filter((appointment) => !isUpcoming(appointment));

  return (
    <div className="appointments-page">
      <header className="appointments-header">
        <div>
          <span className="appointment-eyebrow">CUSTOMER PORTAL</span>
          <h1 className="page-title">Book a service appointment</h1>
          <p className="page-subtitle">
            Choose a vehicle and an available time. Your booking will be sent to the workshop for
            confirmation.
          </p>
        </div>
      </header>
      {bookingResult && (
        <div className="appointment-success-banner" role="status" aria-live="polite">
          <span className="appointment-success-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>
              Appointment request received · {bookingResult.appointment.appointmentNumber}
            </strong>
            <p>
              {bookingResult.appointment.serviceType} for {bookingResult.appointment.vehicle.make}{' '}
              {bookingResult.appointment.vehicle.model} ·{' '}
              {longDate(bookingResult.appointment.preferredDate)} at{' '}
              {bookingResult.appointment.preferredTime}. Status: {bookingResult.appointment.status}.
            </p>
            <small>
              {bookingResult.notificationCreated
                ? 'Confirmation notification added to your account.'
                : 'Booking saved; the in-app notification could not be created.'}
            </small>
          </div>
          <button
            type="button"
            aria-label="Dismiss booking confirmation"
            onClick={startAnotherBooking}
          >
            ×
          </button>
        </div>
      )}
      <section className="appointment-management" aria-labelledby="my-appointments-heading">
        <div className="appointment-management-header">
          <div>
            <span className="appointment-eyebrow">YOUR BOOKINGS</span>
            <h2 id="my-appointments-heading">My appointments</h2>
          </div>
          <button
            className="btn-outline"
            type="button"
            onClick={() => setAppointmentRetry((value) => value + 1)}
          >
            Refresh
          </button>
        </div>
        {managementMessage && (
          <p className="appointment-message success" role="status">
            {managementMessage}
          </p>
        )}
        {managementError && (
          <p className="appointment-message error" role="alert">
            {managementError}
          </p>
        )}
        {appointmentError && (
          <div className="appointment-message error" role="alert">
            <p>{appointmentError}</p>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setAppointmentRetry((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        )}
        {appointments === null ? (
          <p className="appointment-list-loading" role="status">
            Loading your appointments…
          </p>
        ) : (
          <>
            <h3 className="appointment-list-heading">Upcoming appointments</h3>
            {upcomingAppointments.length ? (
              <div className="appointment-record-list">
                {upcomingAppointments.map((appointment) => (
                  <article className="appointment-record" key={appointment.id}>
                    <div className="appointment-record-top">
                      <div>
                        <span className="appointment-record-number">
                          {appointment.appointmentNumber}
                        </span>
                        <h4>{appointment.serviceType}</h4>
                      </div>
                      <span
                        className={`appointment-status status-${appointment.status.toLowerCase().replaceAll(' ', '-')}`}
                      >
                        {serviceStatus(appointment.status)}
                      </span>
                    </div>
                    <div className="appointment-record-summary">
                      <span>
                        {appointment.vehicle
                          ? `${appointment.vehicle.make} ${appointment.vehicle.model} · ${appointment.vehicle.registrationNumber}`
                          : 'Vehicle information unavailable'}
                      </span>
                      <strong>
                        {longDate(appointment.preferredDate)} · {appointment.preferredTime}
                      </strong>
                      {appointment.technician && <span>Technician: {appointment.technician}</span>}
                    </div>
                    <details className="appointment-record-details">
                      <summary>Appointment details</summary>
                      <dl>
                        <div>
                          <dt>Problem description</dt>
                          <dd>{appointment.problemDescription || 'Not provided'}</dd>
                        </div>
                        <div>
                          <dt>Customer notes</dt>
                          <dd>{appointment.customerNotes || 'None'}</dd>
                        </div>
                        <div>
                          <dt>Requested</dt>
                          <dd>
                            {dateLabel(
                              appointment.createdAt?.slice(0, 10) || appointment.preferredDate,
                            )}
                          </dd>
                        </div>
                      </dl>
                    </details>
                    {appointment.rescheduleRequest && (
                      <div className="appointment-reschedule-status">
                        <strong>Reschedule request: {appointment.rescheduleRequest.status}</strong>
                        <span>
                          Requested date:{' '}
                          {appointment.rescheduleRequest.preferredDate
                            ? `${longDate(appointment.rescheduleRequest.preferredDate)} · ${appointment.rescheduleRequest.preferredTime}`
                            : 'Not available'}
                        </span>
                        {appointment.rescheduleRequest.notes && (
                          <span>Note: {appointment.rescheduleRequest.notes}</span>
                        )}
                        {appointment.rescheduleRequest.status === 'Pending' && (
                          <small>
                            The existing appointment remains active until the workshop reviews the
                            request.
                          </small>
                        )}
                      </div>
                    )}
                    {['Pending', 'Confirmed'].includes(appointment.status) && (
                      <div className="appointment-record-actions">
                        {appointment.rescheduleRequest?.status === 'Pending' ? (
                          <button className="btn-outline" type="button" disabled>
                            Reschedule request pending
                          </button>
                        ) : (
                          <button
                            className="btn-outline"
                            type="button"
                            disabled={Boolean(actionId)}
                            onClick={() => {
                              setManagementError('');
                              setRescheduleError('');
                              setRescheduleDay(null);
                              setRescheduleForm({
                                id: appointment.id,
                                date: appointment.preferredDate,
                                time: '',
                                notes: '',
                              });
                            }}
                          >
                            Request reschedule
                          </button>
                        )}
                        <button
                          className="appointment-cancel-trigger"
                          type="button"
                          disabled={Boolean(actionId)}
                          onClick={() => {
                            setCancelConfirmId(appointment.id);
                            setManagementError('');
                          }}
                        >
                          Cancel appointment
                        </button>
                      </div>
                    )}
                    {cancelConfirmId === appointment.id && (
                      <div className="appointment-cancel-confirm">
                        <p>
                          Cancel appointment {appointment.appointmentNumber}? The time slot will
                          become available to other customers.
                        </p>
                        <div>
                          <button
                            className="btn-outline"
                            type="button"
                            disabled={Boolean(actionId)}
                            onClick={() => setCancelConfirmId('')}
                          >
                            Keep appointment
                          </button>
                          <button
                            className="appointment-cancel-trigger"
                            type="button"
                            disabled={Boolean(actionId)}
                            onClick={() => cancelAppointment(appointment)}
                          >
                            {actionId === appointment.id ? 'Cancelling…' : 'Confirm cancellation'}
                          </button>
                        </div>
                      </div>
                    )}
                    {rescheduleForm?.id === appointment.id && (
                      <form className="appointment-reschedule-form" onSubmit={submitReschedule}>
                        <div className="appointment-reschedule-heading">
                          <strong>Request a new time</strong>
                          <button
                            type="button"
                            aria-label="Close reschedule form"
                            onClick={() => {
                              setRescheduleForm(null);
                              setRescheduleDay(null);
                            }}
                          >
                            ×
                          </button>
                        </div>
                        <p>
                          The workshop must review the request. This does not reserve the requested
                          slot.
                        </p>
                        <div className="appointment-reschedule-fields">
                          <label>
                            Date
                            <input
                              type="date"
                              min={today}
                              max={finalBookableDate}
                              required
                              value={rescheduleForm.date}
                              onChange={(event) => {
                                setRescheduleForm((form) => ({
                                  ...form,
                                  date: event.target.value,
                                  time: '',
                                }));
                                setRescheduleDay(null);
                                setRescheduleError('');
                              }}
                            />
                          </label>
                          <label>
                            Preferred time
                            <input type="time" step="60" required disabled={!rescheduleDay?.available}
                              value={rescheduleForm.time}
                              onChange={event => setRescheduleForm(form => ({ ...form, time: event.target.value }))} />
                            {rescheduleDay?.bookedTimes?.length > 0 && <small>Already booked: {rescheduleDay.bookedTimes.join(', ')}</small>}
                            {rescheduleDay?.closed && <small>The workshop is closed on this date.</small>}
                          </label>
                          <label className="appointment-reschedule-note">
                            Note (optional)
                            <input
                              maxLength={500}
                              value={rescheduleForm.notes}
                              onChange={(event) =>
                                setRescheduleForm((form) => ({
                                  ...form,
                                  notes: event.target.value,
                                }))
                              }
                              placeholder="Reason for the change"
                            />
                          </label>
                        </div>
                        {rescheduleError && (
                          <p className="appointment-message error" role="alert">
                            {rescheduleError}
                          </p>
                        )}
                        <div className="appointment-reschedule-actions">
                          <button
                            className="btn-outline"
                            type="button"
                            onClick={() => {
                              setRescheduleForm(null);
                              setRescheduleDay(null);
                            }}
                          >
                            Close
                          </button>
                          <button
                            className="btn-primary"
                            type="submit"
                            disabled={
                              Boolean(actionId) || !rescheduleForm.date || !rescheduleForm.time
                            }
                          >
                            {actionId === appointment.id ? 'Sending…' : 'Send request'}
                          </button>
                        </div>
                      </form>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="appointment-list-empty">No upcoming appointments.</p>
            )}
            <h3 className="appointment-list-heading past">Past or cancelled appointments</h3>
            {pastAppointments.length ? (
              <div className="appointment-record-list">
                {pastAppointments.map((appointment) => (
                  <article className="appointment-record past-record" key={appointment.id}>
                    <div className="appointment-record-top">
                      <div>
                        <span className="appointment-record-number">
                          {appointment.appointmentNumber}
                        </span>
                        <h4>{appointment.serviceType}</h4>
                      </div>
                      <span
                        className={`appointment-status status-${appointment.status.toLowerCase().replaceAll(' ', '-')}`}
                      >
                        {serviceStatus(appointment.status)}
                      </span>
                    </div>
                    <div className="appointment-record-summary">
                      <span>
                        {appointment.vehicle
                          ? `${appointment.vehicle.make} ${appointment.vehicle.model} · ${appointment.vehicle.registrationNumber}`
                          : 'Vehicle information unavailable'}
                      </span>
                      <strong>
                        {longDate(appointment.preferredDate)} · {appointment.preferredTime}
                      </strong>
                      {appointment.technician && <span>Technician: {appointment.technician}</span>}
                    </div>
                    <details className="appointment-record-details">
                      <summary>Appointment details</summary>
                      <p>{appointment.problemDescription || 'No problem description recorded.'}</p>
                      {appointment.customerNotes && <p>Notes: {appointment.customerNotes}</p>}
                    </details>
                  </article>
                ))}
              </div>
            ) : (
              <p className="appointment-list-empty">Your past appointments will appear here.</p>
            )}
          </>
        )}
      </section>
      {!vehicles.length && (
        <section className="appointment-empty">
          <h2>Add a vehicle to book</h2>
          <p>Appointments must be linked to a vehicle registered to your account.</p>
          <Link className="btn-primary" to="/customer/vehicles">
            Manage my vehicles
          </Link>
        </section>
      )}
      {vehicles.length > 0 && (
        <>
          <div className="appointment-step-list" aria-label="Booking steps">
            <span className="active">
              <b>1</b> Service details
            </span>
            <i aria-hidden="true" />
            <span className={selectedDate && selectedTime ? 'active' : ''}>
              <b>2</b> Date and time
            </span>
            <i aria-hidden="true" />
            <span>
              <b>3</b> Confirm
            </span>
          </div>
          <form className="appointment-form" onSubmit={submit}>
            <section className="appointment-section">
              <div className="appointment-section-title">
                <span>01</span>
                <div>
                  <h2>Service details</h2>
                  <p>Tell us which vehicle needs work and what service you need.</p>
                </div>
              </div>
              <div className="appointment-form-grid">
                <label className="appointment-field">
                  Vehicle
                  <select
                    required
                    value={selectedVehicle}
                    onChange={(event) => setSelectedVehicle(event.target.value)}
                  >
                    <option value="" disabled>
                      Select your vehicle
                    </option>
                    {vehicles.map((vehicle) => {
                      const id = vehicle._id || vehicle.id;
                      return (
                        <option value={id} key={id}>
                          {vehicle.make} {vehicle.model} · {vehicle.registrationNumber}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className="appointment-field">
                  Service type
                  <select
                    required
                    value={serviceType}
                    onChange={(event) => setServiceType(event.target.value)}
                  >
                    {options.serviceTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="appointment-field appointment-field-wide">
                  What do you need help with? *
                  <textarea
                    required
                    minLength={3}
                    maxLength={1000}
                    rows={4}
                    value={problemDescription}
                    onChange={(event) => setProblemDescription(event.target.value)}
                    placeholder="Describe the issue, warning light, noise or service needed…"
                  />
                  <small>{problemDescription.length}/1,000 characters</small>
                </label>
                <label className="appointment-field appointment-field-wide">
                  Additional notes <span className="optional-label">Optional</span>
                  <textarea
                    maxLength={1000}
                    rows={3}
                    value={customerNotes}
                    onChange={(event) => setCustomerNotes(event.target.value)}
                    placeholder="Anything else the workshop should know?"
                  />
                  <small>{customerNotes.length}/1,000 characters</small>
                </label>
              </div>
            </section>
            <section className="appointment-section">
              <div className="appointment-section-title">
                <span>02</span>
                <div>
                  <h2>Choose a date and time</h2>
                  <p>Enter your preferred time. Each time can have one booking.</p>
                </div>
              </div>
              <div className="appointment-date-range">
                <button
                  type="button"
                  className="btn-outline"
                  disabled={rangeStart === today}
                  onClick={() => selectRange(shiftDate(rangeStart, -RANGE_DAYS))}
                >
                  ← Earlier
                </button>
                <strong>
                  {dates.length
                    ? `${dateLabel(dates[0].date)} – ${dateLabel(dates[dates.length - 1].date)}`
                    : 'Available dates'}
                </strong>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={rangeStart >= lastBookableRangeStart}
                  onClick={() => selectRange(shiftDate(rangeStart, RANGE_DAYS))}
                >
                  Later →
                </button>
              </div>
              {availabilityError && (
                <div className="appointment-message error" role="alert">
                  <p>{availabilityError}</p>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => {
                      setAvailabilityError('');
                      setAvailabilityRetry((value) => value + 1);
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
              {!availabilityError && (
                <>
                  <div className="appointment-date-grid" role="group" aria-label="Available dates">
                    {dates.map((day) => (
                      <button
                        key={day.date}
                        type="button"
                        className={`appointment-date-option ${selectedDate === day.date ? 'selected' : ''}`}
                        disabled={!day.available}
                        aria-pressed={selectedDate === day.date}
                        onClick={() => changeDate(day.date)}
                      >
                        <span>{dateLabel(day.date)}</span>
                        <small>
                          {day.closed
                            ? 'Workshop closed'
                            : day.available
                              ? 'Choose your time'
                              : 'Fully booked'}
                        </small>
                      </button>
                    ))}
                  </div>
                  <div className="appointment-times">
                    <h3>
                      {selectedDay
                        ? `Preferred time · ${dateLabel(selectedDay.date)}`
                        : 'Choose a date to view times'}
                    </h3>
                    <label>
                      Custom time
                      <input type="time" step="60" required value={selectedTime} disabled={!selectedDay?.available}
                        onChange={event => { setSelectedTime(event.target.value); setFormError(''); }} />
                    </label>
                    {selectedDay?.bookedTimes?.length > 0 && <p>Already booked: {selectedDay.bookedTimes.join(', ')}</p>}
                  </div>
                </>
              )}
            </section>
            <section className="appointment-section appointment-review">
              <div className="appointment-section-title">
                <span>03</span>
                <div>
                  <h2>Review and submit</h2>
                  <p>Your request will be created as Pending until the workshop confirms it.</p>
                </div>
              </div>
              <dl className="appointment-review-grid">
                <div>
                  <dt>Vehicle</dt>
                  <dd>
                    {selectedVehicleDetails
                      ? `${selectedVehicleDetails.make} ${selectedVehicleDetails.model} · ${selectedVehicleDetails.registrationNumber}`
                      : 'Select a vehicle'}
                  </dd>
                </div>
                <div>
                  <dt>Service</dt>
                  <dd>{serviceType || 'Select service type'}</dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{selectedDate ? longDate(selectedDate) : 'Select an available date'}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{selectedTime || 'Select an available time'}</dd>
                </div>
              </dl>
              {formError && (
                <p className="appointment-message error" role="alert">
                  {formError}
                </p>
              )}
              <button
                className="btn-primary appointment-submit"
                type="submit"
                disabled={
                  booking ||
                  !selectedVehicle ||
                  !serviceType ||
                  !selectedDate ||
                  !selectedTime ||
                  !problemDescription.trim()
                }
              >
                {booking ? 'Submitting request…' : 'Confirm appointment request'}
              </button>
            </section>
          </form>
        </>
      )}
      <p className="appointment-back-link">
        <Link to="/customer/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}
