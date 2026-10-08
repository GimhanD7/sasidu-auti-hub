import mongoose from 'mongoose';
import ServiceJob from '../models/ServiceJob.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';

const JOB_STATUSES = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test', 'Ready'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const result = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== value ? null : result;
}

export async function listAdminJobBoard(req, res) {
  const { status, priority, technician, dateFrom, dateTo } = req.query;
  if (status && !JOB_STATUSES.includes(status)) return res.status(400).json({ message: 'Choose a valid job status.' });
  if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ message: 'Choose a valid job priority.' });
  if (technician && technician !== 'unassigned' && !mongoose.isValidObjectId(technician)) return res.status(400).json({ message: 'Choose a valid technician.' });
  const start = dateFrom ? parseDate(dateFrom) : null;
  const end = dateTo ? parseDate(dateTo) : null;
  if ((dateFrom && !start) || (dateTo && !end) || (start && end && start > end)) return res.status(400).json({ message: 'Choose a valid date range.' });
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (technician === 'unassigned') filter.$or = [{ technician: { $exists: false } }, { technician: null }];
  else if (technician) filter.technician = technician;
  if (start || end) filter.createdAt = { ...(start ? { $gte: start } : {}), ...(end ? { $lt: new Date(end.getTime() + 86400000) } : {}) };
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  try {
    if (search) {
      const expression = escapeRegex(search);
      const vehicles = await Vehicle.find({ registrationNumber: { $regex: expression, $options: 'i' } }).select('_id').limit(100).lean();
      const searchFilter = { $or: [{ serviceNumber: { $regex: expression, $options: 'i' } }, ...(vehicles.length ? [{ vehicle: { $in: vehicles.map(vehicle => vehicle._id) } }] : [])] };
      if (filter.$or) filter.$and = [{ $or: filter.$or }, searchFilter];
      else Object.assign(filter, searchFilter);
    }
    const [jobs, technicians] = await Promise.all([
      ServiceJob.find(filter).sort({ createdAt: -1 })
        .populate({ path: 'customer', select: 'name' }).populate({ path: 'vehicle', select: 'make model year registrationNumber' })
        .populate({ path: 'technician', select: 'name technicianSpecialization availabilityStatus' })
        .populate({ path: 'appointment', select: 'serviceType preferredDate' }).lean(),
      User.find({ role: 'Technician', isActive: { $ne: false } }).select('name availabilityStatus').sort({ name: 1 }).lean(),
    ]);
    res.set('Cache-Control', 'private, no-store').json({
      jobs: jobs.map(job => ({ id: String(job._id), serviceNumber: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`, status: job.status, priority: job.priority || 'Normal', customer: job.customer?.name || 'Customer unavailable', vehicle: job.vehicle ? `${job.vehicle.year ? `${job.vehicle.year} ` : ''}${job.vehicle.make} ${job.vehicle.model}` : 'Vehicle unavailable', registrationNumber: job.vehicle?.registrationNumber || '', serviceType: job.appointment?.serviceType || 'Service repair', technicianId: job.technician ? String(job.technician._id) : '', technician: job.technician?.name || 'Unassigned', specialization: job.technician?.technicianSpecialization || '', availabilityStatus: job.technician?.availabilityStatus || 'Available', customerComplaint: job.customerComplaint || '', createdAt: job.createdAt, expectedCompletionTime: job.expectedCompletionTime || null })),
      technicians: technicians.map(person => ({ id: String(person._id), name: person.name, availabilityStatus: person.availabilityStatus || 'Available' })),
      total: jobs.length,
      statuses: JOB_STATUSES,
      priorities: PRIORITIES,
    });
  } catch { res.status(503).json({ message: 'Unable to load workshop jobs.' }); }
}
