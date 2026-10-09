import mongoose from 'mongoose';
import ServiceJob from '../models/ServiceJob.js';
import Appointment from '../models/Appointment.js';
import Vehicle from '../models/Vehicle.js';
import JobPhoto from '../models/JobPhoto.js';

const STATUSES = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test', 'Ready'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const SORTS = {
  recent: { updatedAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  dueSoon: { expectedCompletionTime: 1, updatedAt: -1 },
  priority: { priority: -1, updatedAt: -1 },
};
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function jobSummary(job) {
  return {
    id: String(job._id),
    serviceNumber: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`,
    status: job.status,
    priority: job.priority || 'Normal',
    complaint: job.customerComplaint || '',
    expectedCompletionTime: job.expectedCompletionTime || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: [...(job.timeline || [])].reverse().find(event => event.status === 'Ready')?.timestamp || (job.status === 'Ready' ? job.updatedAt : null),
    customer: job.customer?.name || 'Customer unavailable',
    vehicle: job.vehicle ? { make: job.vehicle.make, model: job.vehicle.model, year: job.vehicle.year, registrationNumber: job.vehicle.registrationNumber } : null,
    serviceType: job.appointment?.serviceType || 'Service repair',
  };
}

export async function listTechnicianJobs(req, res) {
  const { status, priority, sort = 'recent' } = req.query;
  if (status && !STATUSES.includes(status)) return res.status(400).json({ message: 'Choose a valid job status.' });
  if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ message: 'Choose a valid job priority.' });
  if (!SORTS[sort]) return res.status(400).json({ message: 'Choose a valid sort order.' });
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(400).json({ message: 'Choose a valid page and page size (1–50).' });

  const filter = { technician: req.user._id };
  if (status) filter.status = status === 'In Progress' ? { $in: ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test'] } : status;
  if (priority) filter.priority = priority;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  try {
    if (search) {
      const expression = escapeRegex(search);
      const vehicles = await Vehicle.find({ registrationNumber: { $regex: expression, $options: 'i' } }).select('_id').limit(100).lean();
      filter.$or = [
        { serviceNumber: { $regex: expression, $options: 'i' } },
        { customerComplaint: { $regex: expression, $options: 'i' } },
        ...(vehicles.length ? [{ vehicle: { $in: vehicles.map(vehicle => vehicle._id) } }] : []),
      ];
    }
    const [jobs, total, appointments] = await Promise.all([
      ServiceJob.find(filter).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit)
        .populate({ path: 'customer', select: 'name' })
        .populate({ path: 'vehicle', select: 'make model year registrationNumber' })
        .populate({ path: 'appointment', select: 'serviceType preferredDate preferredTime' }).lean(),
      ServiceJob.countDocuments(filter),
      Appointment.find({
        assignedTechnician: req.user._id,
        status: { $in: ['Pending', 'Confirmed', 'Checked In', 'In Service'] },
      })
        .sort({ preferredDate: 1, preferredTime: 1 })
        .populate({ path: 'customer', select: 'name' })
        .populate({ path: 'vehicle', select: 'make model year registrationNumber' })
        .lean(),
    ]);
    const appointmentIds = appointments.map(appointment => appointment._id);
    const linkedJobs = appointmentIds.length
      ? await ServiceJob.find({ appointment: { $in: appointmentIds } }).select('_id appointment').lean()
      : [];
    const jobByAppointment = new Map(linkedJobs.map(job => [String(job.appointment), String(job._id)]));
    res.set('Cache-Control', 'private, no-store').json({
      jobs: jobs.map(jobSummary),
      appointments: appointments.map(appointment => ({
        id: String(appointment._id),
        appointmentNumber: appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`,
        status: appointment.status,
        serviceType: appointment.serviceType,
        preferredDate: appointment.preferredDate,
        preferredTime: appointment.preferredTime,
        customer: appointment.customer?.name || 'Customer unavailable',
        vehicle: appointment.vehicle ? {
          make: appointment.vehicle.make,
          model: appointment.vehicle.model,
          year: appointment.vehicle.year,
          registrationNumber: appointment.vehicle.registrationNumber,
        } : null,
        complaint: appointment.problemDescription || '',
        jobId: jobByAppointment.get(String(appointment._id)) || '',
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch { res.status(503).json({ message: 'Unable to load your assigned jobs. Please try again.' }); }
}

export async function searchTechnicianParts(req, res) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
  if (search.length < 2) return res.json({ parts: [] });
  try {
    const expression = escapeRegex(search);
    const parts = await ServiceJob.aggregate([
      { $unwind: '$replacedParts' },
      { $match: { $or: [
        { 'replacedParts.name': { $regex: expression, $options: 'i' } },
        { 'replacedParts.partNumber': { $regex: expression, $options: 'i' } },
      ] } },
      { $sort: { 'replacedParts.replacedAt': -1 } },
      { $group: {
        _id: { name: '$replacedParts.name', partNumber: '$replacedParts.partNumber' },
        name: { $first: '$replacedParts.name' },
        partNumber: { $first: '$replacedParts.partNumber' },
        unitPrice: { $first: '$replacedParts.unitCost' },
        lastUsedAt: { $first: '$replacedParts.replacedAt' },
      } },
      { $sort: { name: 1 } },
      { $limit: 10 },
    ]);
    res.set('Cache-Control', 'private, no-store').json({ parts: parts.map(part => ({
      id: `${part.partNumber || ''}:${part.name}`,
      name: part.name || 'Part', partNumber: part.partNumber || '', unitPrice: part.unitPrice ?? 0, lastUsedAt: part.lastUsedAt || null,
    })) });
  } catch { res.status(503).json({ message: 'Unable to search previously used parts.' }); }
}

export async function getTechnicianJob(req, res) {
  if (!mongoose.isValidObjectId(req.params.jobId)) return res.status(404).json({ message: 'Service job not found.' });
  try {
    const job = await ServiceJob.findOne({ _id: req.params.jobId, technician: req.user._id })
      .populate({ path: 'customer', select: 'name email mobile' })
      .populate({ path: 'vehicle', select: 'make model year registrationNumber mileage fuelType vinNumber' })
      .populate({ path: 'appointment', select: 'appointmentNumber serviceType preferredDate preferredTime status problemDescription' })
      .populate({ path: 'billingInvoice', select: 'invoiceNumber paymentStatus totalAmount' }).lean();
    if (!job) return res.status(404).json({ message: 'Service job not found.' });
    const photos = await JobPhoto.find({ job: job._id }).select('_id filename contentType category evidenceType description createdAt').sort({ createdAt: -1 }).lean();
    res.set('Cache-Control', 'private, no-store').json({ job: {
      ...jobSummary(job),
      customer: { name: job.customer?.name || 'Customer unavailable', email: job.customer?.email || '', mobile: job.customer?.mobile || '' },
      vehicle: job.vehicle ? { make: job.vehicle.make, model: job.vehicle.model, year: job.vehicle.year, registrationNumber: job.vehicle.registrationNumber, mileage: job.vehicle.mileage, fuelType: job.vehicle.fuelType, vinNumber: job.vehicle.vinNumber } : null,
      appointment: job.appointment ? { number: job.appointment.appointmentNumber || '', serviceType: job.appointment.serviceType, preferredDate: job.appointment.preferredDate, preferredTime: job.appointment.preferredTime, status: job.appointment.status, problemDescription: job.appointment.problemDescription || '' } : null,
      assignedTechnician: req.user.name || 'Technician',
      currentTechnicianId: String(req.user._id),
      inspection: job.inspection || { findings: '', diagnosis: '', notes: '', issues: [], recommendedRepairs: [], startedAt: null, completedAt: null },
      diagnosticReport: job.diagnosticReport?.result ? job.diagnosticReport : null,
      finalTest: job.finalTest || null,
      finalReport: job.finalReport || null,
      billingInvoice: job.billingInvoice ? { id: String(job.billingInvoice._id || job.billingInvoice), invoiceNumber: job.billingInvoice.invoiceNumber || '', paymentStatus: job.billingInvoice.paymentStatus || 'Draft', totalAmount: job.billingInvoice.totalAmount ?? null } : null,
      repairNotes: (job.repairNotes || []).map(note => ({ id: String(note._id), note: note.note, createdAt: note.createdAt, technician: String(note.technician || '') })),
      tasks: (job.tasks || []).map(task => ({ id: String(task._id), title: task.title, status: task.status, notes: task.notes || '', completedAt: task.completedAt || null })),
      replacedParts: (job.replacedParts || []).map(part => ({ id: String(part._id), name: part.name, partNumber: part.partNumber || '', quantity: part.quantity, unitCost: part.unitCost, totalCost: (Number(part.quantity) || 0) * (Number(part.unitCost) || 0), replacedAt: part.replacedAt })),
      partsCost: (job.replacedParts || []).reduce((sum, part) => sum + (Number(part.quantity) || 0) * (Number(part.unitCost) || 0), 0),
      labourEntries: (job.labourEntries || []).map(entry => ({ id: String(entry._id), description: entry.description || 'Repair labour', labourType: entry.labourType || 'Repair', minutes: entry.minutes, ratePerHour: entry.ratePerHour || 0, charge: Math.round((entry.minutes / 60) * (entry.ratePerHour || 0) * 100) / 100, technician: String(entry.technician || ''), startedAt: entry.startedAt || null, endedAt: entry.endedAt || null, recordedAt: entry.recordedAt })),
      activeLabourTimer: job.activeLabourTimer?.startedAt ? { description: job.activeLabourTimer.description || 'Repair labour', labourType: job.activeLabourTimer.labourType || 'Repair', ratePerHour: job.activeLabourTimer.ratePerHour || 0, technician: String(job.activeLabourTimer.technician || ''), startedAt: job.activeLabourTimer.startedAt } : null,
      labourMinutes: (job.labourEntries || []).reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0),
      labourCost: Math.round((job.labourEntries || []).reduce((sum, entry) => sum + ((Number(entry.minutes) || 0) / 60) * (Number(entry.ratePerHour) || 0), 0) * 100) / 100,
      photos: photos.map(photo => ({ id: String(photo._id), filename: photo.filename, contentType: photo.contentType, category: photo.category || 'Job', evidenceType: photo.evidenceType || 'General', description: photo.description || '', createdAt: photo.createdAt })),
      additionalRepairs: [],
      timeline: (job.timeline || []).map(event => ({ status: event.status, timestamp: event.timestamp, notes: event.notes || '' })),
    } });
  } catch { res.status(503).json({ message: 'Unable to load this service job. Please try again.' }); }
}
