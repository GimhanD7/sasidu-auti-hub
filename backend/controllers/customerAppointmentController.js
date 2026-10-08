import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';
import Vehicle from '../models/Vehicle.js';

const SERVICE_TYPES = ['Full Service', 'Oil Change', 'Brake Service', 'Engine Diagnosis', 'Electrical Diagnosis', 'General Repair'];
const DEFAULT_TIMES = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'];
const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Checked In', 'In Service'];
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function availableTimes() {
  const configured = process.env.APPOINTMENT_SLOT_TIMES?.split(',').map(time => time.trim()).filter(time => TIME_PATTERN.test(time));
  return [...new Set(configured?.length ? configured : DEFAULT_TIMES)].sort();
}

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

export function getAppointmentOptions(req, res) {
  res.set('Cache-Control', 'private, no-store').json({ serviceTypes: SERVICE_TYPES, times: availableTimes(), businessDays: [...businessWeekdays()], daysAhead: 30 });
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
    const existing = await Appointment.find({
      preferredDate: { $gte: from, $lt: end },
      status: { $in: ACTIVE_STATUSES },
    }).select('preferredDate preferredTime').lean();
    const counts = new Map();
    for (const appointment of existing) {
      const key = slotKey(dateKey(appointment.preferredDate), appointment.preferredTime);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const times = availableTimes();
    const dates = Array.from({ length: days }, (_, index) => {
      const date = dateKey(new Date(from.getTime() + index * 24 * 60 * 60 * 1000));
      const businessDay = isBusinessDay(new Date(`${date}T00:00:00.000Z`));
      const slots = times.map(time => ({ time, available: businessDay && !counts.has(slotKey(date, time)) }));
      return { date, closed: !businessDay, available: slots.some(slot => slot.available), slots };
    });
    res.set('Cache-Control', 'private, no-store').json({ dates });
  } catch {
    res.status(503).json({ message: 'Unable to load appointment availability. Please try again.' });
  }
}

export async function createCustomerAppointment(req, res) {
  const { vehicleId, serviceType, preferredDate, preferredTime, problemDescription, customerNotes = '' } = req.body || {};
  const day = parseDay(preferredDate);
  if (!mongoose.isValidObjectId(vehicleId)) return res.status(400).json({ message: 'Select one of your registered vehicles.' });
  if (!SERVICE_TYPES.includes(serviceType)) return res.status(400).json({ message: 'Choose a valid service type.' });
  if (!day || !TIME_PATTERN.test(preferredTime || '') || !availableTimes().includes(preferredTime)) return res.status(400).json({ message: 'Choose an available date and time slot.' });
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
    });

    let notificationCreated = false;
    try {
      await Notification.create({
        user: req.user._id,
        type: 'AppointmentConfirmation',
        title: 'Appointment request received',
        message: `${appointmentNumber}: ${serviceType} for ${vehicle.make} ${vehicle.model} on ${dateKey(day)} at ${preferredTime}.`,
        link: '/customer/appointments',
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
