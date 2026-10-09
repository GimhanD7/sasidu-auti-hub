// List technician workloads and change job assignments, keeping the linked appointment and assignment history in sync.
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';
import ServiceJob from '../models/ServiceJob.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';

const ALLOCATABLE_STATUSES = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test'];
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listAdminAllocations(req, res) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  try {
    const filter = { status: { $in: ALLOCATABLE_STATUSES } };
    if (search) {
      const expression = escapeRegex(search);
      const vehicles = await Vehicle.find({ registrationNumber: { $regex: expression, $options: 'i' } }).select('_id').limit(100).lean();
      filter.$or = [{ serviceNumber: { $regex: expression, $options: 'i' } }, ...(vehicles.length ? [{ vehicle: { $in: vehicles.map(item => item._id) } }] : [])];
    }
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const [jobs, technicians, assignmentCounts, activeCounts] = await Promise.all([
      ServiceJob.find(filter).sort({ updatedAt: -1 }).limit(300)
        .populate({ path: 'customer', select: 'name' }).populate({ path: 'vehicle', select: 'make model registrationNumber' })
        .populate({ path: 'technician', select: 'name technicianSpecialization availabilityStatus' })
        .populate({ path: 'appointment', select: 'serviceType preferredDate' }).lean(),
      User.find({ role: 'Technician', isActive: { $ne: false } }).select('name email technicianSpecialization availabilityStatus').sort({ name: 1 }).lean(),
      ServiceJob.aggregate([{ $unwind: '$technicianAssignments' }, { $match: { 'technicianAssignments.assignedAt': { $gte: today }, 'technicianAssignments.action': { $in: ['Assigned', 'Reassigned'] } } }, { $group: { _id: '$technicianAssignments.technician', count: { $sum: 1 } } }]),
      ServiceJob.aggregate([{ $match: { status: { $in: ALLOCATABLE_STATUSES }, technician: { $ne: null } } }, { $group: { _id: '$technician', count: { $sum: 1 } } }]),
    ]);
    const assignments = new Map(assignmentCounts.filter(item => item._id).map(item => [String(item._id), item.count]));
    const workload = new Map(activeCounts.filter(item => item._id).map(item => [String(item._id), item.count]));
    res.set('Cache-Control', 'private, no-store').json({
      jobs: jobs.map(job => ({ id: String(job._id), reference: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`, status: job.status, priority: job.priority || 'Normal', customer: job.customer?.name || 'Customer unavailable', vehicle: job.vehicle ? `${job.vehicle.make} ${job.vehicle.model}` : 'Vehicle unavailable', registrationNumber: job.vehicle?.registrationNumber || '', serviceType: job.appointment?.serviceType || 'Service repair', technicianId: job.technician ? String(job.technician._id) : '', technician: job.technician?.name || '', updatedAt: job.updatedAt, assignedAt: job.technicianAssignments?.slice().reverse().find(item => String(item.technician) === String(job.technician?._id))?.assignedAt || null })),
      technicians: technicians.map(person => ({ id: String(person._id), name: person.name, email: person.email, specialization: person.technicianSpecialization || 'Not set', availabilityStatus: person.availabilityStatus || 'Available', activeJobs: workload.get(String(person._id)) || 0, assignedToday: assignments.get(String(person._id)) || 0 })),
    });
  } catch { res.status(503).json({ message: 'Unable to load technician allocation data.' }); }
}

// Record assignment history, update the linked appointment, and notify technicians whose assignments changed.
export async function updateAdminJobTechnician(req, res) {
  const { jobId } = req.params;
  const technicianId = req.body?.technicianId;
  if (!mongoose.isValidObjectId(jobId)) return res.status(400).json({ message: 'Invalid service job.' });
  if (technicianId && !mongoose.isValidObjectId(technicianId)) return res.status(400).json({ message: 'Choose a valid technician or leave the job unassigned.' });
  try {
    const job = await ServiceJob.findOne({ _id: jobId, status: { $in: ALLOCATABLE_STATUSES } });
    if (!job) return res.status(404).json({ message: 'Open service job not found.' });
    const previousId = job.technician ? String(job.technician) : '';
    const nextId = technicianId ? String(technicianId) : '';
    if (previousId === nextId) return res.json({ id: String(job._id), technicianId: nextId, message: 'No assignment changes were needed.' });

    let nextTechnician;
    if (nextId) {
      nextTechnician = await User.findOne({ _id: nextId, role: 'Technician', isActive: { $ne: false } }).select('name availabilityStatus');
      if (!nextTechnician) return res.status(404).json({ message: 'Active technician not found.' });
      if ((nextTechnician.availabilityStatus || 'Available') !== 'Available') return res.status(409).json({ message: 'Only an Available technician can receive this assignment.' });
    }
    const action = !nextId ? 'Removed' : previousId ? 'Reassigned' : 'Assigned';
    const previousTechnicianId = job.technician;
    job.technician = nextTechnician?._id;
    job.technicianAssignments.push({ technician: nextTechnician?._id || previousTechnicianId, assignedBy: req.user._id, assignedAt: new Date(), action });
    // Persist the changes made to job above; document validation and registered save hooks run here.
    await job.save();
    if (job.appointment) {
      const appointmentUpdate = nextTechnician?._id
        ? { $set: { assignedTechnician: nextTechnician._id } }
        : { $unset: { assignedTechnician: 1 } };
      // Apply the specified appointment database changes only to records matching this filter.
      await Appointment.updateOne({ _id: job.appointment }, appointmentUpdate);
    }
    if (previousId && previousId !== nextId) await Notification.create({ user: previousId, type: 'ServiceJobUnassigned', title: 'Service job assignment changed', message: `${job.serviceNumber} is no longer assigned to you.`, link: '/technician/jobs' }).catch(() => {});
    if (nextId) await Notification.create({ user: nextId, type: 'ServiceJobAssigned', title: action === 'Reassigned' ? 'Service job reassigned' : 'New service job assigned', message: `${job.serviceNumber} has been ${action.toLowerCase()} to you.`, link: '/technician/jobs' }).catch(() => {});
    res.set('Cache-Control', 'private, no-store').json({ id: String(job._id), technicianId: nextId, technician: nextTechnician?.name || '', action, assignedAt: job.technicianAssignments.at(-1)?.assignedAt || null });
  } catch { res.status(503).json({ message: 'Unable to update the service job assignment.' }); }
}
