import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import ServiceJob from '../models/ServiceJob.js';
import { hashToken, newToken } from '../utils/session.js';
import { passwordResetEmail } from '../services/passwordResetEmail.js';
import { getActiveServiceTypeNames } from './adminServiceTypeController.js';

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const ACTIVE_STATUSES = ['Pending', 'Confirmed', 'Checked In', 'In Service'];
const availableTimes = () => {
  const configured = process.env.APPOINTMENT_SLOT_TIMES?.split(',').map(time => time.trim()).filter(time => TIME_PATTERN.test(time));
  return [...new Set(configured?.length ? configured : ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'])].sort();
};
const businessDays = () => {
  const configured = process.env.APPOINTMENT_BUSINESS_DAYS?.split(',').map(Number).filter(day => Number.isInteger(day) && day >= 1 && day <= 7);
  return new Set(configured?.length ? configured : [1, 2, 3, 4, 5, 6, 7]);
};
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function getAdminAppointmentOptions(req, res) {
  const customerId = req.query.customerId;
  if (customerId && !mongoose.isValidObjectId(customerId)) return res.status(400).json({ message: 'Choose a valid customer.' });
  try {
    const serviceTypes = await getActiveServiceTypeNames();
    let customers = [];
    let vehicles = [];
    if (customerId) {
      const customer = await User.findOne({ _id: customerId, role: { $in: ['Customer', 'user'] }, isActive: { $ne: false } }).select('name email mobile').lean();
      if (!customer) return res.status(404).json({ message: 'Customer not found.' });
      vehicles = await Vehicle.find({ customer: customerId }).select('make model year registrationNumber').sort({ registrationNumber: 1 }).lean();
    } else {
      const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
      const filter = { role: { $in: ['Customer', 'user'] }, isActive: { $ne: false } };
      if (search) {
        const escaped = escapeRegex(search);
        filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }, { mobile: { $regex: escaped, $options: 'i' } }];
      }
      customers = await User.find(filter).select('name email mobile').sort({ name: 1 }).limit(25).lean();
    }
    res.set('Cache-Control', 'private, no-store').json({
      customers: customers.map(item => ({ id: String(item._id), name: item.name, email: item.email, mobile: item.mobile || '' })),
      vehicles: vehicles.map(item => ({ id: String(item._id), make: item.make, model: item.model, year: item.year || null, registrationNumber: item.registrationNumber })),
      serviceTypes,
      times: availableTimes(),
    });
  } catch {
    res.status(503).json({ message: 'Unable to load customer and booking options.' });
  }
}

export async function createAdminAppointment(req, res) {
  const body = req.body || {};
  const { customerId, newCustomer, vehicleId, newVehicle, serviceType, preferredDate, preferredTime, problemDescription, customerNotes = '', internalNotes = '' } = body;
  if ((!customerId && !newCustomer) || (customerId && newCustomer)) return res.status(400).json({ message: 'Select an existing customer or enter a new customer.' });
  if ((!vehicleId && !newVehicle) || (vehicleId && newVehicle)) return res.status(400).json({ message: 'Select an existing vehicle or enter a new vehicle.' });
  let serviceTypeNames;
  try { serviceTypeNames = await getActiveServiceTypeNames(); }
  catch { return res.status(503).json({ message: 'Unable to validate the selected service type.' }); }
  if (!serviceTypeNames.includes(serviceType)) return res.status(400).json({ message: 'Choose a valid service type.' });
  if (typeof problemDescription !== 'string' || !problemDescription.trim() || problemDescription.trim().length > 1000) return res.status(400).json({ message: 'Enter a customer complaint of 1 to 1,000 characters.' });
  if (typeof customerNotes !== 'string' || customerNotes.trim().length > 1000 || typeof internalNotes !== 'string' || internalNotes.trim().length > 1000) return res.status(400).json({ message: 'Notes must be 1,000 characters or fewer.' });
  if (typeof preferredDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || typeof preferredTime !== 'string' || !availableTimes().includes(preferredTime)) return res.status(400).json({ message: 'Choose a valid appointment date and time.' });
  const day = new Date(`${preferredDate}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== preferredDate) return res.status(400).json({ message: 'Choose a valid appointment date.' });
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (day < today || day.getTime() > today.getTime() + 30 * 24 * 60 * 60 * 1000) return res.status(400).json({ message: 'Choose an appointment date from today through the next 30 days.' });
  if (!businessDays().has(day.getUTCDay() || 7)) return res.status(400).json({ message: 'The workshop is closed on that date.' });
  if (new Date(`${preferredDate}T${preferredTime}:00.000Z`) <= new Date()) return res.status(400).json({ message: 'Choose a future appointment time.' });

  let newCustomerData;
  if (!customerId) {
    const name = typeof newCustomer?.name === 'string' ? newCustomer.name.trim() : '';
    const email = typeof newCustomer?.email === 'string' ? newCustomer.email.trim().toLowerCase() : '';
    const mobile = typeof newCustomer?.mobile === 'string' ? newCustomer.mobile.replace(/[\s()-]/g, '') : '';
    if (name.length < 2 || name.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?\d{10,15}$/.test(mobile)) return res.status(400).json({ message: 'Enter a valid customer name, email, and mobile number.' });
    newCustomerData = { name, email, mobile };
  }
  let newVehicleData;
  if (!vehicleId) {
    const make = typeof newVehicle?.make === 'string' ? newVehicle.make.trim() : '';
    const model = typeof newVehicle?.model === 'string' ? newVehicle.model.trim() : '';
    const registrationNumber = typeof newVehicle?.registrationNumber === 'string' ? newVehicle.registrationNumber.trim().toUpperCase() : '';
    const year = newVehicle?.year === '' || newVehicle?.year == null ? undefined : Number(newVehicle.year);
    if (make.length < 1 || make.length > 80 || model.length < 1 || model.length > 80 || registrationNumber.length < 2 || registrationNumber.length > 32 || (year !== undefined && (!Number.isInteger(year) || year < 1886 || year > new Date().getUTCFullYear() + 1))) return res.status(400).json({ message: 'Enter valid vehicle make, model, registration number, and year.' });
    newVehicleData = { make, model, registrationNumber, ...(year ? { year } : {}) };
  }
  if (customerId && !mongoose.isValidObjectId(customerId)) return res.status(400).json({ message: 'Choose a valid customer.' });
  if (vehicleId && !mongoose.isValidObjectId(vehicleId)) return res.status(400).json({ message: 'Choose a valid vehicle.' });

  const end = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  let createdCustomerId;
  let createdVehicleId;
  try {
    const conflict = await Appointment.exists({ preferredDate: { $gte: day, $lt: end }, preferredTime, status: { $in: ACTIVE_STATUSES } });
    if (conflict) return res.status(409).json({ message: 'That time slot has just been booked. Select another available time.' });
    if (newVehicleData && await Vehicle.exists({ registrationNumber: newVehicleData.registrationNumber })) return res.status(409).json({ message: 'A vehicle with this registration number already exists.' });
    if (newCustomerData && await User.exists({ $or: [{ email: newCustomerData.email }, { mobile: newCustomerData.mobile }] })) return res.status(409).json({ message: 'A customer already exists with this email or mobile number. Search and select that customer.' });

    let customer;
    if (customerId) {
      customer = await User.findOne({ _id: customerId, role: { $in: ['Customer', 'user'] }, isActive: { $ne: false } }).select('name email mobile');
      if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    } else {
      const password = randomBytes(32).toString('base64url');
      customer = await User.create({ ...newCustomerData, password: await bcrypt.hash(password, 10), role: 'Customer' });
      createdCustomerId = customer._id;
    }

    let vehicle;
    if (vehicleId) {
      vehicle = await Vehicle.findOne({ _id: vehicleId, customer: customer._id }).select('make model registrationNumber');
      if (!vehicle) return res.status(404).json({ message: 'Choose a vehicle belonging to the selected customer.' });
    } else {
      vehicle = await Vehicle.create({ customer: customer._id, ...newVehicleData });
      createdVehicleId = vehicle._id;
    }

    const appointmentObjectId = new mongoose.Types.ObjectId();
    const appointmentNumber = `APT-${preferredDate.replaceAll('-', '')}-${appointmentObjectId.toString().slice(-6).toUpperCase()}`;
    const appointment = await Appointment.create({
      _id: appointmentObjectId, appointmentNumber, bookingSlotKey: `${preferredDate}|${preferredTime}`,
      customer: customer._id, vehicle: vehicle._id, serviceType, preferredDate: day, preferredTime,
      problemDescription: problemDescription.trim(), customerNotes: customerNotes.trim(), internalNotes: internalNotes.trim(), status: 'Pending',
      history: [{ action: 'Appointment created', details: `Initial status: Pending · ${serviceType}`, actor: req.user._id }],
    });

    let notificationCreated = false;
    try {
      await Notification.create({ user: customer._id, type: 'AppointmentConfirmation', title: 'Appointment request received',
        message: `${appointmentNumber}: ${serviceType} for ${vehicle.make} ${vehicle.model} on ${preferredDate} at ${preferredTime}.`,
        link: '/customer/appointments', dedupeKey: `appointment-created:${appointment._id}` });
      notificationCreated = true;
    } catch { /* The appointment remains saved if notification storage is temporarily unavailable. */ }

    let accountSetupEmailSent = false;
    if (createdCustomerId && passwordResetEmail.isConfigured()) {
      try {
        const token = newToken();
        await User.updateOne({ _id: createdCustomerId }, { $set: { resetTokenHash: hashToken(token), resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
        await passwordResetEmail.send(customer.email, token);
        accountSetupEmailSent = true;
      } catch { /* The appointment is valid; the new customer can use the workshop's account setup process when mail is available. */ }
    }

    res.status(201).set('Cache-Control', 'private, no-store').json({
      appointment: { id: String(appointment._id), appointmentNumber, customer: customer.name, vehicle: `${vehicle.make} ${vehicle.model}`, registrationNumber: vehicle.registrationNumber, serviceType, preferredDate, preferredTime, status: appointment.status },
      notificationCreated, accountSetupEmailSent, newCustomer: Boolean(createdCustomerId),
    });
  } catch (error) {
    if (createdVehicleId) await Vehicle.deleteOne({ _id: createdVehicleId }).catch(() => {});
    if (createdCustomerId) await User.deleteOne({ _id: createdCustomerId }).catch(() => {});
    if (error.code === 11000) return res.status(409).json({ message: 'That time slot or vehicle registration has just been used. Refresh and try again.' });
    if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ message: 'Check the appointment, customer, and vehicle details.' });
    res.status(503).json({ message: 'Unable to create the appointment. Please try again.' });
  }
}

export async function getAdminAppointment(req, res) {
  if (!mongoose.isValidObjectId(req.params.appointmentId)) return res.status(400).json({ message: 'Invalid appointment.' });
  try {
    const appointment = await Appointment.findById(req.params.appointmentId).select('+internalNotes')
      .populate({ path: 'customer', select: 'name email mobile' }).populate({ path: 'vehicle', select: 'make model year registrationNumber vinNumber' })
      .populate({ path: 'assignedTechnician', select: 'name' }).populate({ path: 'history.actor', select: 'name' }).lean();
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
    const job = await ServiceJob.findOne({ appointment: appointment._id }).select('serviceNumber status').lean();
    res.set('Cache-Control', 'private, no-store').json({
      id: String(appointment._id), appointmentNumber: appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`,
      customer: appointment.customer ? { id: String(appointment.customer._id), name: appointment.customer.name, email: appointment.customer.email, mobile: appointment.customer.mobile || '' } : null,
      vehicle: appointment.vehicle ? { id: String(appointment.vehicle._id), make: appointment.vehicle.make, model: appointment.vehicle.model, year: appointment.vehicle.year || null, registrationNumber: appointment.vehicle.registrationNumber, vinNumber: appointment.vehicle.vinNumber || '' } : null,
      serviceType: appointment.serviceType, preferredDate: appointment.preferredDate.toISOString().slice(0, 10), preferredTime: appointment.preferredTime,
      problemDescription: appointment.problemDescription || '', customerNotes: appointment.customerNotes || '', internalNotes: appointment.internalNotes || '',
      status: appointment.status, technicianId: appointment.assignedTechnician ? String(appointment.assignedTechnician._id) : '',
      technician: appointment.assignedTechnician?.name || '',
      rescheduleRequest: appointment.rescheduleRequest?.status === 'Pending' ? { preferredDate: appointment.rescheduleRequest.preferredDate?.toISOString().slice(0, 10), preferredTime: appointment.rescheduleRequest.preferredTime, notes: appointment.rescheduleRequest.notes || '' } : null,
      history: (appointment.history || []).map(event => ({ action: event.action, details: event.details || '', timestamp: event.timestamp, actor: event.actor?.name || 'System' })),
      serviceJob: job ? { id: String(job._id), serviceNumber: job.serviceNumber, status: job.status } : null,
    });
  } catch { res.status(503).json({ message: 'Unable to load appointment details.' }); }
}

export async function updateAdminAppointment(req, res) {
  if (!mongoose.isValidObjectId(req.params.appointmentId)) return res.status(400).json({ message: 'Invalid appointment.' });
  const body = req.body || {};
  try {
    const appointment = await Appointment.findById(req.params.appointmentId).select('+internalNotes');
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
    const oldDate = appointment.preferredDate.toISOString().slice(0, 10);
    const oldTime = appointment.preferredTime;
    const oldStatus = appointment.status;
    const oldServiceType = appointment.serviceType;
    const oldTechnician = appointment.assignedTechnician ? String(appointment.assignedTechnician) : '';

    if (body.rescheduleDecision !== undefined) {
      if (body.preferredDate !== undefined || body.preferredTime !== undefined) return res.status(400).json({ message: 'Resolve a reschedule request separately from changing the appointment time.' });
      if (!['Approved', 'Rejected'].includes(body.rescheduleDecision)) return res.status(400).json({ message: 'Choose Approve or Reject for the reschedule request.' });
      if (appointment.rescheduleRequest?.status !== 'Pending') return res.status(409).json({ message: 'There is no pending reschedule request to resolve.' });
      if (!['Pending', 'Confirmed'].includes(appointment.status)) return res.status(409).json({ message: 'Only a pending or confirmed appointment can resolve this reschedule request.' });
      if (body.rescheduleDecision === 'Approved') {
        const requestedDay = appointment.rescheduleRequest.preferredDate;
        const requestedTime = appointment.rescheduleRequest.preferredTime;
        const requestedKey = requestedDay?.toISOString().slice(0, 10);
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        if (!requestedKey || !availableTimes().includes(requestedTime) || requestedDay < today || requestedDay.getTime() > today.getTime() + 30 * 86400000 || !businessDays().has(requestedDay.getUTCDay() || 7) || new Date(`${requestedKey}T${requestedTime}:00.000Z`) <= new Date()) return res.status(409).json({ message: 'The requested time is no longer a valid future workshop slot.' });
        const conflict = await Appointment.exists({ _id: { $ne: appointment._id }, preferredDate: { $gte: requestedDay, $lt: new Date(requestedDay.getTime() + 86400000) }, preferredTime: requestedTime, status: { $in: ACTIVE_STATUSES } });
        if (conflict) return res.status(409).json({ message: 'The requested time has just been booked. Reject the request or choose another time.' });
        appointment.preferredDate = requestedDay;
        appointment.preferredTime = requestedTime;
      }
      appointment.rescheduleRequest.status = body.rescheduleDecision;
      appointment.rescheduleRequest.respondedAt = new Date();
    }

    if (body.status !== undefined) {
      if (body.status !== oldStatus && !['Pending', 'Confirmed', 'Cancelled'].includes(body.status)) return res.status(400).json({ message: 'Service progress is updated by the technician. Choose Pending, Confirmed, or Cancelled.' });
      if (['In Service', 'Completed'].includes(oldStatus) && body.status !== oldStatus) return res.status(409).json({ message: 'This service has already started or completed.' });
      if (!['Pending', 'Confirmed', 'Checked In', 'In Service', 'Completed', 'Cancelled'].includes(body.status)) return res.status(400).json({ message: 'Choose a valid appointment status.' });
      appointment.status = body.status;
    }
    const hasDate = body.preferredDate !== undefined;
    const hasTime = body.preferredTime !== undefined;
    if (hasDate !== hasTime) return res.status(400).json({ message: 'Choose both a new date and time when rescheduling.' });
    if (hasDate) {
      if (typeof body.preferredDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.preferredDate) || typeof body.preferredTime !== 'string' || !availableTimes().includes(body.preferredTime)) return res.status(400).json({ message: 'Choose a valid appointment date and time.' });
      const day = new Date(`${body.preferredDate}T00:00:00.000Z`);
      if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== body.preferredDate) return res.status(400).json({ message: 'Choose a valid appointment date.' });
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      if (day < today || day.getTime() > today.getTime() + 30 * 86400000 || !businessDays().has(day.getUTCDay() || 7) || new Date(`${body.preferredDate}T${body.preferredTime}:00.000Z`) <= new Date()) return res.status(400).json({ message: 'Choose an open future appointment time within the next 30 days.' });
      if (['Pending', 'Confirmed', 'Checked In', 'In Service'].includes(appointment.status)) {
        const conflict = await Appointment.exists({ _id: { $ne: appointment._id }, preferredDate: { $gte: day, $lt: new Date(day.getTime() + 86400000) }, preferredTime: body.preferredTime, status: { $in: ACTIVE_STATUSES } });
        if (conflict) return res.status(409).json({ message: 'That time slot has just been booked. Select another slot.' });
      }
      appointment.preferredDate = day;
      appointment.preferredTime = body.preferredTime;
      if (appointment.rescheduleRequest?.status === 'Pending') {
        const approved = appointment.rescheduleRequest.preferredDate?.toISOString().slice(0, 10) === body.preferredDate && appointment.rescheduleRequest.preferredTime === body.preferredTime;
        appointment.rescheduleRequest.status = approved ? 'Approved' : 'Rejected';
        appointment.rescheduleRequest.respondedAt = new Date();
      }
    }
    if (body.serviceType !== undefined) {
      if (body.serviceType !== appointment.serviceType && !(await getActiveServiceTypeNames()).includes(body.serviceType)) return res.status(400).json({ message: 'Choose a valid service type.' });
      appointment.serviceType = body.serviceType;
    }
    for (const [field, label] of [['problemDescription', 'Customer complaint'], ['customerNotes', 'Customer notes'], ['internalNotes', 'Internal notes']]) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== 'string' || body[field].trim().length > 1000 || (field === 'problemDescription' && !body[field].trim())) return res.status(400).json({ message: `${label} must be no more than 1,000 characters${field === 'problemDescription' ? ' and cannot be empty' : ''}.` });
        appointment[field] = body[field].trim();
      }
    }
    if (body.technicianId !== undefined) {
      if (body.technicianId === '') appointment.assignedTechnician = undefined;
      else {
        if (!mongoose.isValidObjectId(body.technicianId)) return res.status(400).json({ message: 'Choose a valid technician.' });
        const technician = await User.findOne({ _id: body.technicianId, role: 'Technician', isActive: { $ne: false } }).select('_id availabilityStatus');
        if (!technician) return res.status(404).json({ message: 'Active technician not found.' });
        if (String(technician._id) !== oldTechnician && (technician.availabilityStatus || 'Available') !== 'Available') return res.status(409).json({ message: 'This technician is unavailable for new assignments.' });
        appointment.assignedTechnician = technician._id;
      }
    }
    if (appointment.status === 'Confirmed' && !appointment.assignedTechnician) return res.status(400).json({ message: 'Assign a technician before confirming this appointment.' });
    appointment.bookingSlotKey = ['Pending', 'Confirmed', 'Checked In', 'In Service'].includes(appointment.status)
      ? `${appointment.preferredDate.toISOString().slice(0, 10)}|${appointment.preferredTime}` : undefined;
    const changes = [];
    if (oldStatus !== appointment.status) changes.push(`Status: ${oldStatus} → ${appointment.status}`);
    if (oldDate !== appointment.preferredDate.toISOString().slice(0, 10) || oldTime !== appointment.preferredTime) changes.push(`Scheduled time: ${oldDate} ${oldTime} → ${appointment.preferredDate.toISOString().slice(0, 10)} ${appointment.preferredTime}`);
    if (oldServiceType !== appointment.serviceType) changes.push(`Service type: ${oldServiceType} → ${appointment.serviceType}`);
    if (oldTechnician !== (appointment.assignedTechnician ? String(appointment.assignedTechnician) : '')) changes.push('Technician assignment changed');
    if (body.rescheduleDecision !== undefined) changes.push(`Customer reschedule request ${body.rescheduleDecision.toLowerCase()}`);
    if (changes.length) appointment.history.push({ action: 'Appointment updated', details: changes.join(' · ').slice(0, 1000), actor: req.user._id });
    await appointment.save();

    const newTechnician = appointment.assignedTechnician ? String(appointment.assignedTechnician) : '';
    const relatedJob = await ServiceJob.findOne({ appointment: appointment._id });
    if (relatedJob && body.technicianId !== undefined) {
      if (newTechnician !== oldTechnician) relatedJob.technicianAssignments.push({ technician: appointment.assignedTechnician, assignedBy: req.user._id, assignedAt: new Date(), action: !newTechnician ? 'Removed' : oldTechnician ? 'Reassigned' : 'Assigned' });
      relatedJob.technician = appointment.assignedTechnician;
      await relatedJob.save();
    }
    if (relatedJob && oldTechnician && oldTechnician !== newTechnician) await Notification.create({ user: oldTechnician, type: 'ServiceJobUnassigned', title: 'Service job assignment changed', message: 'A service job assigned to you has been reassigned or removed.', link: '/technician/jobs' }).catch(() => {});
    if (appointment.status === 'Cancelled' && oldStatus !== 'Cancelled') {
      await Notification.create({ user: appointment.customer, type: 'AppointmentCancelled', title: 'Appointment cancelled', message: `Appointment ${appointment.appointmentNumber || ''} on ${appointment.preferredDate.toISOString().slice(0, 10)} at ${appointment.preferredTime} was cancelled by the workshop.`, link: '/customer/appointments', dedupeKey: `admin-appointment-cancelled:${appointment._id}:${appointment.updatedAt.getTime()}` }).catch(() => {});
    } else if (oldDate !== appointment.preferredDate.toISOString().slice(0, 10) || oldTime !== appointment.preferredTime) {
      await Notification.create({ user: appointment.customer, type: 'AppointmentRescheduled', title: 'Appointment rescheduled', message: `Appointment ${appointment.appointmentNumber || ''} is now scheduled for ${appointment.preferredDate.toISOString().slice(0, 10)} at ${appointment.preferredTime}.`, link: '/customer/appointments', dedupeKey: `admin-appointment-rescheduled:${appointment._id}:${appointment.updatedAt.getTime()}` }).catch(() => {});
    } else if (body.rescheduleDecision === 'Rejected') {
      await Notification.create({ user: appointment.customer, type: 'AppointmentRescheduleRejected', title: 'Reschedule request declined', message: `Your reschedule request for appointment ${appointment.appointmentNumber || ''} was declined. The original appointment remains scheduled for ${appointment.preferredDate.toISOString().slice(0, 10)} at ${appointment.preferredTime}.`, link: '/customer/appointments', dedupeKey: `admin-reschedule-rejected:${appointment._id}:${appointment.updatedAt.getTime()}` }).catch(() => {});
    }
    if (newTechnician && newTechnician !== oldTechnician) await Notification.create({ user: newTechnician, type: 'AppointmentAssigned', title: 'Appointment assigned', message: `${appointment.appointmentNumber || 'A workshop appointment'} has been assigned to you.`, link: '/technician/dashboard', dedupeKey: `appointment-assigned:${appointment._id}:${newTechnician}:${appointment.updatedAt.getTime()}` }).catch(() => {});
    res.set('Cache-Control', 'private, no-store').json({ id: String(appointment._id), status: appointment.status, preferredDate: appointment.preferredDate.toISOString().slice(0, 10), preferredTime: appointment.preferredTime, technicianId: newTechnician });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That time slot has just been booked. Select another slot.' });
    if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ message: 'Check the appointment details and try again.' });
    res.status(503).json({ message: 'Unable to update the appointment. Please try again.' });
  }
}

export async function convertAdminAppointmentToJob(req, res) {
  if (!mongoose.isValidObjectId(req.params.appointmentId)) return res.status(400).json({ message: 'Invalid appointment.' });
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
    const isAssignedTechnician = req.user.role === 'Technician';
    if (isAssignedTechnician && String(appointment.assignedTechnician) !== String(req.user._id)) return res.status(403).json({ message: 'You can only start the workflow for appointments assigned to you.' });
    if (appointment.status === 'Cancelled' || appointment.status === 'Completed') return res.status(409).json({ message: 'Cancelled or completed appointments cannot be converted to service jobs.' });
    let job = await ServiceJob.findOne({ appointment: appointment._id });
    if (job) {
      if (isAssignedTechnician && String(job.technician) !== String(req.user._id)) return res.status(403).json({ message: 'This appointment’s service job is assigned to another technician.' });
      if (appointment.status !== 'In Service') {
        appointment.status = 'In Service';
        appointment.history.push({ action: 'Status changed', details: 'Status: existing service job linked; moved to In Service', actor: req.user._id });
        appointment.bookingSlotKey = undefined;
        await appointment.save();
      }
      return res.status(200).json({ id: String(job._id), serviceNumber: job.serviceNumber, status: job.status, alreadyCreated: true });
    }
    const startableStatuses = isAssignedTechnician ? ['Confirmed', 'Checked In', 'In Service'] : ['Confirmed', 'Checked In'];
    if (!startableStatuses.includes(appointment.status)) return res.status(409).json({ message: 'The workshop must confirm the appointment before you can start the service.' });
    const priority = req.body?.priority || 'Normal';
    if (!['Low', 'Normal', 'High', 'Urgent'].includes(priority)) return res.status(400).json({ message: 'Choose a valid job priority.' });
    const rawExpectedCompletionTime = req.body?.expectedCompletionTime;
    const expectedCompletionTime = rawExpectedCompletionTime ? new Date(rawExpectedCompletionTime) : undefined;
    if (rawExpectedCompletionTime && (Number.isNaN(expectedCompletionTime.getTime()) || expectedCompletionTime <= new Date())) return res.status(400).json({ message: 'Expected completion time must be a valid future date and time.' });
    const customerComplaint = typeof req.body?.customerComplaint === 'string' ? req.body.customerComplaint.trim() : appointment.problemDescription?.trim() || (isAssignedTechnician ? appointment.serviceType?.trim() : '');
    if (!customerComplaint || customerComplaint.length > 1000) return res.status(400).json({ message: 'A customer complaint of 1 to 1,000 characters is required.' });
    const technicianId = req.body?.technicianId;
    if (technicianId) {
      if (!mongoose.isValidObjectId(technicianId)) return res.status(400).json({ message: 'Choose a valid technician.' });
      const technician = await User.findOne({ _id: technicianId, role: 'Technician', isActive: { $ne: false } }).select('_id availabilityStatus');
      if (!technician) return res.status(404).json({ message: 'Active technician not found.' });
      if ((technician.availabilityStatus || 'Available') !== 'Available') return res.status(409).json({ message: 'This technician is unavailable for a new service job assignment.' });
      appointment.assignedTechnician = technician._id;
    }
    if (appointment.assignedTechnician && !isAssignedTechnician) {
      const assignedTechnician = await User.findOne({ _id: appointment.assignedTechnician, role: 'Technician', isActive: { $ne: false } }).select('availabilityStatus');
      if (!assignedTechnician || (assignedTechnician.availabilityStatus || 'Available') !== 'Available') return res.status(409).json({ message: 'The appointment’s assigned technician is unavailable. Reassign or remove them before creating this service job.' });
    }
    job = await ServiceJob.create({ appointment: appointment._id, customer: appointment.customer, vehicle: appointment.vehicle, technician: appointment.assignedTechnician, technicianAssignments: appointment.assignedTechnician ? [{ technician: appointment.assignedTechnician, assignedBy: req.user._id, assignedAt: new Date(), action: 'Assigned' }] : [], customerComplaint, priority, expectedCompletionTime, status: 'In Progress', timeline: [{ status: 'In Progress', actor: req.user._id, notes: `Created from ${appointment.appointmentNumber || 'appointment'}.` }] });
    appointment.status = 'In Service';
    appointment.history.push({ action: 'Service job created', details: `Moved to In Service · ${job.serviceNumber}`, actor: req.user._id });
    appointment.bookingSlotKey = undefined;
    await appointment.save();
    if (appointment.assignedTechnician) await Notification.create({ user: appointment.assignedTechnician, type: 'ServiceJobAssigned', title: 'New service job assigned', message: `${job.serviceNumber} has been assigned to you.`, link: '/technician/jobs' }).catch(() => {});
    res.status(201).set('Cache-Control', 'private, no-store').json({ id: String(job._id), serviceNumber: job.serviceNumber, status: job.status, priority: job.priority, expectedCompletionTime: job.expectedCompletionTime || null, customerComplaint: job.customerComplaint, alreadyCreated: false });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await ServiceJob.findOne({ appointment: req.params.appointmentId }).select('serviceNumber status').lean();
      if (existing) return res.status(200).json({ id: String(existing._id), serviceNumber: existing.serviceNumber, status: existing.status, alreadyCreated: true });
    }
    res.status(503).json({ message: 'Unable to convert this appointment to a service job. Please try again.' });
  }
}
