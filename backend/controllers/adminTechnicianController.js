import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import ServiceJob from '../models/ServiceJob.js';
import User from '../models/User.js';
import { hashToken, newToken } from '../utils/session.js';
import { passwordResetEmail } from '../services/passwordResetEmail.js';

const CURRENT_JOB_STATUSES = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test'];
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function parseTechnician(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const mobile = typeof body.mobile === 'string' ? body.mobile.replace(/[\s()-]/g, '') : '';
  const specialization = typeof body.technicianSpecialization === 'string' ? body.technicianSpecialization.trim() : '';
  const days = body.workSchedule?.days;
  const startTime = body.workSchedule?.startTime;
  const endTime = body.workSchedule?.endTime;
  if (name.length < 2 || name.length > 100) return { error: 'Name must contain 2 to 100 characters.' };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' };
  if (mobile && !/^\+?\d{10,15}$/.test(mobile)) return { error: 'Enter a valid mobile number with 10 to 15 digits.' };
  if (!specialization || specialization.length > 120) return { error: 'Enter a specialization of up to 120 characters.' };
  if (!Array.isArray(days) || days.some(day => !Number.isInteger(day) || day < 1 || day > 7)) return { error: 'Choose valid working days.' };
  if (!TIME_PATTERN.test(startTime || '') || !TIME_PATTERN.test(endTime || '') || startTime >= endTime) return { error: 'Enter valid working hours with the end time after the start time.' };
  return { data: { name, email, mobile: mobile || undefined, technicianSpecialization: specialization, workSchedule: { days: [...new Set(days)].sort(), startTime, endTime } } };
}

const technicianView = user => ({ id: String(user._id), name: user.name, email: user.email, mobile: user.mobile || '', specialization: user.technicianSpecialization || 'Not set', availabilityStatus: user.availabilityStatus || 'Available', workSchedule: { days: user.workSchedule?.days || [1, 2, 3, 4, 5, 6], startTime: user.workSchedule?.startTime || '09:00', endTime: user.workSchedule?.endTime || '17:00' }, isActive: user.isActive !== false, createdAt: user.createdAt });

export async function listAdminTechnicians(req, res) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const filter = { role: 'Technician' };
  if (search) {
    const expression = escapeRegex(search);
    filter.$or = [{ name: { $regex: expression, $options: 'i' } }, { email: { $regex: expression, $options: 'i' } }, { mobile: { $regex: expression, $options: 'i' } }, { technicianSpecialization: { $regex: expression, $options: 'i' } }];
  }
  try {
    const users = await User.find(filter).select('name email mobile technicianSpecialization availabilityStatus workSchedule isActive createdAt').sort({ name: 1 }).lean();
    const ids = users.map(user => user._id);
    const [activeCounts, readyCounts, appointmentCounts] = await Promise.all([
      ServiceJob.aggregate([{ $match: { technician: { $in: ids }, status: { $in: CURRENT_JOB_STATUSES } } }, { $group: { _id: '$technician', count: { $sum: 1 } } }]),
      ServiceJob.aggregate([{ $match: { technician: { $in: ids }, status: 'Ready' } }, { $group: { _id: '$technician', count: { $sum: 1 } } }]),
      Appointment.aggregate([{ $match: { assignedTechnician: { $in: ids }, status: { $nin: ['Cancelled', 'Completed'] }, preferredDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }, { $group: { _id: '$assignedTechnician', count: { $sum: 1 } } }]),
    ]);
    const countMap = entries => new Map(entries.map(entry => [String(entry._id), entry.count]));
    const active = countMap(activeCounts); const ready = countMap(readyCounts); const appointments = countMap(appointmentCounts);
    res.set('Cache-Control', 'private, no-store').json({ technicians: users.map(user => ({ ...technicianView(user), activeJobs: active.get(String(user._id)) || 0, readyJobs: ready.get(String(user._id)) || 0, upcomingAppointments: appointments.get(String(user._id)) || 0 })) });
  } catch { res.status(503).json({ message: 'Unable to load technicians.' }); }
}

export async function createAdminTechnician(req, res) {
  const { data, error } = parseTechnician(req.body);
  if (error) return res.status(400).json({ message: error });
  try {
    if (await User.exists({ $or: [{ email: data.email }, ...(data.mobile ? [{ mobile: data.mobile }] : [])] })) return res.status(409).json({ message: 'A user already exists with this email or mobile.' });
    const generatedPassword = randomBytes(32).toString('base64url');
    const user = await User.create({ ...data, password: await bcrypt.hash(generatedPassword, 10), role: 'Technician' });
    let accountSetupEmailSent = false;
    if (passwordResetEmail.isConfigured()) {
      try {
        const token = newToken();
        await User.updateOne({ _id: user._id }, { $set: { resetTokenHash: hashToken(token), resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
        await passwordResetEmail.send(user.email, token);
        accountSetupEmailSent = true;
      } catch { /* Save the technician even if account setup email delivery is unavailable. */ }
    }
    res.status(201).set('Cache-Control', 'private, no-store').json({ technician: technicianView(user), accountSetupEmailSent });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A user already exists with this email or mobile.' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Check technician details and try again.' });
    res.status(503).json({ message: 'Unable to create technician.' });
  }
}

export async function updateAdminTechnician(req, res) {
  if (!mongoose.isValidObjectId(req.params.technicianId)) return res.status(400).json({ message: 'Invalid technician.' });
  const { data, error } = parseTechnician(req.body);
  if (error) return res.status(400).json({ message: error });
  try {
    const user = await User.findOne({ _id: req.params.technicianId, role: 'Technician' });
    if (!user) return res.status(404).json({ message: 'Technician not found.' });
    if (await User.exists({ _id: { $ne: user._id }, $or: [{ email: data.email }, ...(data.mobile ? [{ mobile: data.mobile }] : [])] })) return res.status(409).json({ message: 'Another user already has this email or mobile.' });
    Object.assign(user, data);
    await user.save();
    res.set('Cache-Control', 'private, no-store').json({ technician: technicianView(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Another user already has this email or mobile.' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Check technician details and try again.' });
    res.status(503).json({ message: 'Unable to update technician.' });
  }
}

export async function getAdminTechnician(req, res) {
  if (!mongoose.isValidObjectId(req.params.technicianId)) return res.status(400).json({ message: 'Invalid technician.' });
  try {
    const user = await User.findOne({ _id: req.params.technicianId, role: 'Technician' }).select('name email mobile technicianSpecialization availabilityStatus workSchedule isActive createdAt').lean();
    if (!user) return res.status(404).json({ message: 'Technician not found.' });
    const [jobs, appointments] = await Promise.all([
      ServiceJob.find({ technician: user._id }).sort({ updatedAt: -1 }).limit(100).populate({ path: 'customer', select: 'name' }).populate({ path: 'vehicle', select: 'make model registrationNumber' }).populate({ path: 'appointment', select: 'serviceType preferredDate' }).lean(),
      Appointment.find({ assignedTechnician: user._id }).sort({ preferredDate: -1, preferredTime: -1 }).limit(100).populate({ path: 'customer', select: 'name' }).populate({ path: 'vehicle', select: 'make model registrationNumber' }).lean(),
    ]);
    const activeJobs = jobs.filter(job => CURRENT_JOB_STATUSES.includes(job.status));
    const readyJobs = jobs.filter(job => job.status === 'Ready');
    res.set('Cache-Control', 'private, no-store').json({ technician: technicianView(user), summary: { activeJobs: activeJobs.length, readyJobs: readyJobs.length, appointments: appointments.filter(item => !['Cancelled', 'Completed'].includes(item.status)).length }, jobs: jobs.map(job => ({ id: String(job._id), reference: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`, status: job.status, customer: job.customer?.name || 'Customer unavailable', vehicle: job.vehicle ? `${job.vehicle.make} ${job.vehicle.model} (${job.vehicle.registrationNumber})` : 'Vehicle unavailable', serviceType: job.appointment?.serviceType || 'Service repair', updatedAt: job.updatedAt })), appointments: appointments.map(item => ({ id: String(item._id), reference: item.appointmentNumber || `APT-${String(item._id).slice(-8).toUpperCase()}`, status: item.status, customer: item.customer?.name || 'Customer unavailable', vehicle: item.vehicle ? `${item.vehicle.make} ${item.vehicle.model} (${item.vehicle.registrationNumber})` : 'Vehicle unavailable', serviceType: item.serviceType, preferredDate: item.preferredDate, preferredTime: item.preferredTime })) });
  } catch { res.status(503).json({ message: 'Unable to load technician details.' }); }
}

export async function updateAdminTechnicianAvailability(req, res) {
  const status = req.body?.availabilityStatus;
  if (!['Available', 'Busy', 'Break', 'Off Duty', 'Leave'].includes(status)) return res.status(400).json({ message: 'Choose Available, Busy, Break, Off Duty, or Leave.' });
  if (!mongoose.isValidObjectId(req.params.technicianId)) return res.status(400).json({ message: 'Invalid technician.' });
  try {
    const technician = await User.findOneAndUpdate({ _id: req.params.technicianId, role: 'Technician' }, { availabilityStatus: status }, { new: true, runValidators: true }).select('name availabilityStatus');
    if (!technician) return res.status(404).json({ message: 'Technician not found.' });
    res.set('Cache-Control', 'private, no-store').json({ id: String(technician._id), name: technician.name, availabilityStatus: technician.availabilityStatus || 'Available' });
  } catch { res.status(503).json({ message: 'Unable to update technician availability.' }); }
}
