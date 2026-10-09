import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';
import Vehicle from '../models/Vehicle.js';
import User from '../models/User.js';
import { getActiveServiceTypeNames } from './adminServiceTypeController.js';

const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Checked In', 'In Service'];
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;


function businessWeekdays() {
  const configured = process.env.APPOINTMENT_BUSINESS_DAYS?.split(',').map(day => Number(day.trim())).filter(day => Number.isInteger(day) && day >= 1 && day <= 7);
  return new Set(configured?.length ? configured : [1, 2, 3, 4, 5, 6, 7]);
}

function isBusinessDay(date) {
  const weekday = date.getUTCDay() || 7;
  return businessWeekdays().has(weekday);
}

function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const start = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== value) return null;
  return start;
}

function dateKey(date) { return date.toISOString().slice(0, 10); }
function slotKey(date, time) { return `${date}|${time}`; }
function isFutureSlot(date, time) { return new Date(`${date}T${time}:00`).getTime() > Date.now(); }

export async function getAppointmentOptions(req, res) {
  try {
    const serviceTypes = await getActiveServiceTypeNames();
    res.set('Cache-Control', 'private, no-store').json({ serviceTypes, businessDays: [...businessWeekdays()], daysAhead: 30 });
  } catch { res.status(503).json({ message: 'Unable to load appointment options.' }); }
}

function appointmentView(appointment) {
  return {
    id: appointment._id,
    appointmentNumber: appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`,
    vehicle: appointment.vehicle ? {
      id: appointment.vehicle._id,
      make: appointment.vehicle.make,
      model: appointment.vehicle.model,
      year: appointment.vehicle.year,
      registrationNumber: appointment.vehicle.registrationNumber,
    } : null,
    serviceType: appointment.serviceType,
    preferredDate: dateKey(appointment.preferredDate),
    preferredTime: appointment.preferredTime,
    problemDescription: appointment.problemDescription || '',
    customerNotes: appointment.customerNotes || '',
    status: appointment.status,
    technician: appointment.assignedTechnician?.name || null,
    createdAt: appointment.createdAt,
    rescheduleRequest: appointment.rescheduleRequest?.status ? {
      preferredDate: appointment.rescheduleRequest.preferredDate ? dateKey(appointment.rescheduleRequest.preferredDate) : null,
      preferredTime: appointment.rescheduleRequest.preferredTime,
      notes: appointment.rescheduleRequest.notes || '',
      status: appointment.rescheduleRequest.status,
      requestedAt: appointment.rescheduleRequest.requestedAt,
    } : null,
  };
}

export async function listCustomerAppointments(req, res) {
  try {
    const appointments = await Appointment.find({ customer: req.user._id })
      .sort({ preferredDate: 1, preferredTime: 1 })
      .populate({ path: 'vehicle', select: 'make model year registrationNumber' })
      .populate({ path: 'assignedTechnician', select: 'name' })
      .limit(200).lean();
    res.set('Cache-Control', 'private, no-store').json(appointments.map(appointmentView));
  } catch {
    res.status(503).json({ message: 'Unable to load your appointments. Please try again.' });
  }
}

export async function getAppointmentAvailability(req, res) {
  const from = parseDay(req.query.from);
  const days = Number(req.query.days || 14);
  if (!from || !Number.isInteger(days) || days < 1 || days > 30) {
    return res.status(400).json({ message: 'Choose a valid start date and a range of 1 to 30 days.' });
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const end = new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
  if (from < today || from.getTime() > today.getTime() + 30 * 24 * 60 * 60 * 1000 || end.getTime() > today.getTime() + 31 * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ message: 'Choose a date from today through the next 30 days.' });
  }
  try {
    const excludeAppointmentId = req.query.excludeAppointmentId;
    let excludedId;
    if (excludeAppointmentId !== undefined) {
      if (!mongoose.isValidObjectId(excludeAppointmentId)) return res.status(400).json({ message: 'Invalid appointment ID.' });
      const appointment = await Appointment.findOne({ _id: excludeAppointmentId, customer: req.user._id, status: { $in: ACTIVE_STATUSES } }).select('_id');
      if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
      excludedId = appointment._id;
    }
    const existing = await Appointment.find({
      preferredDate: { $gte: from, $lt: end },
      status: { $in: ACTIVE_STATUSES },
      ...(excludedId ? { _id: { $ne: excludedId } } : {}),
    }).select('preferredDate preferredTime').lean();
    const counts = new Map();
    for (const appointment of existing) {
      const key = slotKey(dateKey(appointment.preferredDate), appointment.preferredTime);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dates = Array.from({ length: days }, (_, index) => {
      const date = dateKey(new Date(from.getTime() + index * 24 * 60 * 60 * 1000));
      const businessDay = isBusinessDay(new Date(`${date}T00:00:00.000Z`));
      const bookedTimes = [...counts.keys()].filter(key => key.startsWith(date + '|')).map(key => key.split('|')[1]);
      return { date, closed: !businessDay, available: businessDay && isFutureSlot(date, '23:59'), bookedTimes };
    });
    res.set('Cache-Control', 'private, no-store').json({ dates });
  } catch {
    res.status(503).json({ message: 'Unable to load appointment availability. Please try again.' });
  }
}

function isAppointmentUpcoming(appointment) {
  const date = appointment.preferredDate.toISOString().slice(0, 10);
  return new Date(`${date}T${appointment.preferredTime}:00`).getTime() > Date.now();
}

async function notifyAppointmentChange(appointment, { type, title, message, dedupeKey }) {
  try {
    const notifications = [{ user: appointment.customer, type, title, message, link: '/customer/appointments', ...(dedupeKey ? { dedupeKey: `${dedupeKey}:${appointment.customer}` } : {}) }];
    const admins = await User.find({ role: { $in: ['Admin', 'admin'] }, isActive: { $ne: false } }).select('_id').lean();
    for (const admin of admins) notifications.push({ user: admin._id, type, title, message, link: '/admin/appointments', ...(dedupeKey ? { dedupeKey: `${dedupeKey}:${admin._id}` } : {}) });
    await Notification.insertMany(notifications, { ordered: false });
    return true;
  } catch { return false; }
}

export async function cancelCustomerAppointment(req, res) {
  if (!mongoose.isValidObjectId(req.params.appointmentId)) return res.status(400).json({ message: 'Invalid appointment ID.' });
  try {
    const appointment = await Appointment.findOne({ _id: req.params.appointmentId, customer: req.user._id });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
    if (!['Pending', 'Confirmed'].includes(appointment.status) || !isAppointmentUpcoming(appointment)) {
      return res.status(409).json({ message: 'Only future pending or confirmed appointments can be cancelled online. Contact the workshop for help with an appointment already in service.' });
    }
    appointment.status = 'Cancelled';
    appointment.history.push({ action: 'Appointment cancelled', details: 'Cancelled by customer', actor: req.user._id });
    await appointment.save();
    const number = appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`;
    const notified = await notifyAppointmentChange(appointment, {
      type: 'AppointmentCancelled', title: 'Appointment cancelled', message: `Appointment ${number} on ${dateKey(appointment.preferredDate)} at ${appointment.preferredTime} was cancelled.`, dedupeKey: `appointment-cancelled:${appointment._id}`,
    });
    res.set('Cache-Control', 'private, no-store').json({ appointment: appointmentView(appointment.toObject()), notificationCreated: notified });
  } catch {
    res.status(503).json({ message: 'Unable to cancel this appointment. Please try again.' });
  }
}

export async function requestCustomerAppointmentReschedule(req, res) {
  if (!mongoose.isValidObjectId(req.params.appointmentId)) return res.status(400).json({ message: 'Invalid appointment ID.' });
  const { preferredDate, preferredTime, notes = '' } = req.body || {};
  const day = parseDay(preferredDate);
  if (!day || !TIME_PATTERN.test(preferredTime || '') || !isBusinessDay(day) || !isFutureSlot(dateKey(day), preferredTime)) return res.status(400).json({ message: 'Choose a valid available date and time for your reschedule request.' });
  if (typeof notes !== 'string' || notes.trim().length > 500) return res.status(400).json({ message: 'Reschedule notes must be 500 characters or fewer.' });
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (day < today || day.getTime() > today.getTime() + 30 * 24 * 60 * 60 * 1000) return res.status(400).json({ message: 'Choose a date from today through the next 30 days.' });

  try {
    const appointment = await Appointment.findOne({ _id: req.params.appointmentId, customer: req.user._id });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
    if (!['Pending', 'Confirmed'].includes(appointment.status) || !isAppointmentUpcoming(appointment)) return res.status(409).json({ message: 'Only future pending or confirmed appointments can be rescheduled online.' });
    if (appointment.rescheduleRequest?.status === 'Pending') return res.status(409).json({ message: 'A reschedule request is already awaiting workshop review.' });
    const end = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    const conflict = await Appointment.exists({
      _id: { $ne: appointment._id }, preferredDate: { $gte: day, $lt: end }, preferredTime,
      status: { $in: ACTIVE_STATUSES },
    });
    if (conflict) return res.status(409).json({ message: 'That time is no longer available. Select another slot.' });

    appointment.rescheduleRequest = { preferredDate: day, preferredTime, notes: notes.trim(), status: 'Pending', requestedAt: new Date() };
    appointment.history.push({ action: 'Reschedule requested', details: `Requested ${dateKey(day)} at ${preferredTime}${notes.trim() ? ` · ${notes.trim()}` : ''}`.slice(0, 1000), actor: req.user._id });
    await appointment.save();
    const number = appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`;
    const notified = await notifyAppointmentChange(appointment, {
      type: 'AppointmentRescheduleRequest', title: 'Reschedule request received', message: `A new time was requested for appointment ${number}: ${dateKey(day)} at ${preferredTime}. The existing booking remains in place until review.`, dedupeKey: `appointment-reschedule-request:${appointment._id}:${appointment.rescheduleRequest.requestedAt.getTime()}`,
    });
    res.set('Cache-Control', 'private, no-store').json({ appointment: appointmentView(appointment.toObject()), notificationCreated: notified });
  } catch {
    res.status(503).json({ message: 'Unable to send the reschedule request. Please try again.' });
  }
}

export async function createCustomerAppointment(req, res) {
  const { vehicleId, serviceType, preferredDate, preferredTime, problemDescription, customerNotes = '' } = req.body || {};
  const day = parseDay(preferredDate);
  if (!mongoose.isValidObjectId(vehicleId)) return res.status(400).json({ message: 'Select one of your registered vehicles.' });
  let serviceTypeNames;
  try { serviceTypeNames = await getActiveServiceTypeNames(); }
  catch { return res.status(503).json({ message: 'Unable to validate the selected service type.' }); }
  if (!serviceTypeNames.includes(serviceType)) return res.status(400).json({ message: 'Choose a valid service type.' });
  if (!day || !TIME_PATTERN.test(preferredTime || '')) return res.status(400).json({ message: 'Choose an available date and time slot.' });
  if (typeof problemDescription !== 'string' || !problemDescription.trim() || problemDescription.trim().length > 1000) {
    return res.status(400).json({ message: 'Describe the service problem in 1 to 1,000 characters.' });
  }
  if (typeof customerNotes !== 'string' || customerNotes.trim().length > 1000) return res.status(400).json({ message: 'Customer notes must be 1,000 characters or fewer.' });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (day < today || day.getTime() > today.getTime() + 30 * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ message: 'Choose an appointment date from today through the next 30 days.' });
  }
  if (!isBusinessDay(day)) return res.status(400).json({ message: 'The workshop is closed on that date. Select another available day.' });
  if (!isFutureSlot(dateKey(day), preferredTime)) return res.status(400).json({ message: 'Choose a future appointment time.' });

  try {
    const vehicle = await Vehicle.findOne({ _id: vehicleId, customer: req.user._id }).select('make model registrationNumber');
    if (!vehicle) return res.status(404).json({ message: 'That vehicle is not registered to your account.' });

    const end = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    const conflict = await Appointment.exists({
      preferredDate: { $gte: day, $lt: end }, preferredTime,
      status: { $in: ACTIVE_STATUSES },
    });
    if (conflict) return res.status(409).json({ message: 'That time slot has just been booked. Select another available time.' });

    const appointmentId = new mongoose.Types.ObjectId();
    const appointmentNumber = `APT-${dateKey(day).replaceAll('-', '')}-${appointmentId.toString().slice(-6).toUpperCase()}`;
    const appointment = await Appointment.create({
      _id: appointmentId,
      appointmentNumber,
      bookingSlotKey: slotKey(dateKey(day), preferredTime),
      customer: req.user._id,
      vehicle: vehicle._id,
      serviceType,
      preferredDate: day,
      preferredTime,
      problemDescription: problemDescription.trim(),
      customerNotes: customerNotes.trim(),
      status: 'Pending',
      history: [{ action: 'Appointment requested', details: `Initial status: Pending · ${serviceType}`, actor: req.user._id }],
    });

    let notificationCreated = false;
    try {
      await Notification.create({
        user: req.user._id,
        type: 'AppointmentConfirmation',
        title: 'Appointment request received',
        message: `${appointmentNumber}: ${serviceType} for ${vehicle.make} ${vehicle.model} on ${dateKey(day)} at ${preferredTime}.`,
        link: '/customer/appointments',
        dedupeKey: `appointment-created:${appointment._id}`,
      });
      notificationCreated = true;
    } catch {
      // The booking remains valid if the notification service is unavailable.
    }

    res.status(201).set('Cache-Control', 'private, no-store').json({
      appointment: {
        id: appointment._id,
        appointmentNumber: appointment.appointmentNumber,
        vehicle: { id: vehicle._id, make: vehicle.make, model: vehicle.model, registrationNumber: vehicle.registrationNumber },
        serviceType: appointment.serviceType,
        preferredDate: dateKey(appointment.preferredDate),
        preferredTime: appointment.preferredTime,
        problemDescription: appointment.problemDescription,
        customerNotes: appointment.customerNotes,
        status: appointment.status,
      },
      notificationCreated,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That time slot has just been booked. Select another available time.' });
    if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ message: 'Check the appointment details and try again.' });
    res.status(503).json({ message: 'Unable to book this appointment. Please try again.' });
  }
}
