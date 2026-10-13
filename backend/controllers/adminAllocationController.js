// List technician workloads and change job assignments, keeping the linked appointment and assignment history in sync.
import mongoose from 'mongoose';
import { appointmentAssignmentTime } from '../utils/appointmentAssignment.js';
import { technicianAssignmentConflict } from '../utils/technicianAvailability.js';
import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';
import ServiceJob from '../models/ServiceJob.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';

const ALLOCATABLE_STATUSES = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test'];
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listAdminAllocations(req, res) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const technicianId = req.query.technician;
  if (technicianId && !mongoose.isValidObjectId(technicianId)) return res.status(400).json({ message: 'Choose a valid technician.' });
  try {
    const filter = {};
    const appointmentFilter = { status: { $in: ['Pending', 'Confirmed', 'Checked In'] } };
    if (technicianId) {
      filter.technician = technicianId;
      appointmentFilter.assignedTechnician = technicianId;
    }
    if (search) {
      const expression = escapeRegex(search);
      const vehicles = await Vehicle.find({ registrationNumber: { $regex: expression, $options: 'i' } }).select('_id').limit(100).lean();
      filter.$or = [{ serviceNumber: { $regex: expression, $options: 'i' } }, ...(vehicles.length ? [{ vehicle: { $in: vehicles.map(item => item._id) } }] : [])];
      const customers = await User.find({ role: { $in: ['Customer', 'user'] }, name: { $regex: expression, $options: 'i' } }).select('_id').limit(100).lean();
      if (customers.length) filter.$or.push({ customer: { $in: customers.map(item => item._id) } });
      appointmentFilter.$or = [{ appointmentNumber: { $regex: expression, $options: 'i' } }, ...filter.$or.slice(1)];
      const matchingTechnicians = await User.find({ role: 'Technician', name: { $regex: expression, $options: 'i' } }).select('_id').limit(100).lean();
      if (matchingTechnicians.length) {
        const ids = matchingTechnicians.map(item => item._id);
        filter.$or.push({ technician: { $in: ids } });
        appointmentFilter.$or.push({ assignedTechnician: { $in: ids } });
      }
    }
    const today = new Date(Date.now() + 330 * 60000); today.setUTCHours(0, 0, 0, 0); today.setTime(today.getTime() - 330 * 60000);
    const tomorrow = new Date(today.getTime() + 86400000);
    const [jobs, technicians, assignmentCounts, activeCounts, appointments, pendingCounts, assignedBookings] = await Promise.all([
      ServiceJob.find(filter).sort({ createdAt: -1, _id: -1 }).limit(300)
        .populate({ path: 'customer', select: 'name' }).populate({ path: 'vehicle', select: 'make model registrationNumber' })
        .populate({ path: 'technician', select: 'name technicianSpecialization availabilityStatus' })
        .populate({ path: 'appointment', select: 'serviceType preferredDate preferredTime assignedTechnician technicianAssignedAt history' }).lean(),
      User.find({ role: 'Technician', isActive: { $ne: false } }).select('name email technicianSpecialization availabilityStatus').sort({ name: 1 }).lean(),
      ServiceJob.aggregate([{ $unwind: '$technicianAssignments' }, { $match: { 'technicianAssignments.assignedAt': { $gte: today }, 'technicianAssignments.action': { $in: ['Assigned', 'Reassigned'] } } }, { $group: { _id: '$technicianAssignments.technician', count: { $sum: 1 } } }]),
      ServiceJob.aggregate([{ $match: { status: { $in: ALLOCATABLE_STATUSES }, technician: { $ne: null } } }, { $group: { _id: '$technician', count: { $sum: 1 } } }]),
      Appointment.find(appointmentFilter).sort({ createdAt: -1, _id: -1 }).limit(300)
        .populate({ path: 'customer', select: 'name' }).populate({ path: 'vehicle', select: 'make model registrationNumber' })
        .populate({ path: 'assignedTechnician', select: 'name availabilityStatus' }).lean(),
      Appointment.aggregate([
        { $match: { status: { $in: ['Pending', 'Confirmed', 'Checked In'] }, assignedTechnician: { $ne: null } } },
        { $lookup: { from: ServiceJob.collection.name, localField: '_id', foreignField: 'appointment', as: 'linkedJobs' } },
        { $match: { linkedJobs: { $size: 0 } } },
        { $group: { _id: '$assignedTechnician', count: { $sum: 1 } } },
      ]),
      Appointment.find({ assignedTechnician: { $ne: null }, status: { $ne: 'Cancelled' } }).select('assignedTechnician technicianAssignedAt history').lean(),
    ]);
    const linkedJobs = appointments.length ? await ServiceJob.find({ appointment: { $in: appointments.map(item => item._id) } }).select('appointment').lean() : [];
    const linkedAppointmentIds = new Set(linkedJobs.map(item => String(item.appointment)));
    const assignments = new Map(assignmentCounts.filter(item => item._id).map(item => [String(item._id), item.count]));
    const bookingIds = assignedBookings.map(item => item._id);
    const startedBookings = bookingIds.length ? await ServiceJob.find({ appointment: { $in: bookingIds } }).select('appointment technician technicianAssignments').lean() : [];
    const linkedAssignments = new Map(startedBookings.map(job => [String(job.appointment), job]));
    for (const booking of assignedBookings) {
      const assignedAt = appointmentAssignmentTime(booking);
      if (!assignedAt || new Date(assignedAt) < today || new Date(assignedAt) >= tomorrow) continue;
      const personId = String(booking.assignedTechnician);
      const linked = linkedAssignments.get(String(booking._id));
      const alreadyCounted = linked?.technicianAssignments?.some(entry => String(entry.technician) === personId && ['Assigned', 'Reassigned'].includes(entry.action) && new Date(entry.assignedAt) >= today && new Date(entry.assignedAt) < tomorrow);
      if (!alreadyCounted) assignments.set(personId, (assignments.get(personId) || 0) + 1);
    }
    const workload = new Map(activeCounts.filter(item => item._id).map(item => [String(item._id), item.count]));
    const pending = new Map(pendingCounts.map(item => [String(item._id), item.count]));
    res.set('Cache-Control', 'private, no-store').json({
      jobs: [
        ...jobs.map(job => ({ id: String(job._id), recordType: 'job', canAssign: ALLOCATABLE_STATUSES.includes(job.status), reference: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`, status: job.status, priority: job.priority || 'Normal', customer: job.customer?.name || 'Customer unavailable', vehicle: job.vehicle ? `${job.vehicle.make} ${job.vehicle.model}` : 'Vehicle unavailable', registrationNumber: job.vehicle?.registrationNumber || '', serviceType: job.appointment?.serviceType || 'Service repair', technicianId: job.technician ? String(job.technician._id) : '', technician: job.technician?.name || '', availabilityStatus: job.technician?.availabilityStatus || '', preferredDate: job.appointment?.preferredDate || job.createdAt, preferredTime: job.appointment?.preferredTime || '', createdAt: job.createdAt, updatedAt: job.updatedAt, assignedAt: job.technicianAssignments?.slice().reverse().find(item => String(item.technician) === String(job.technician?._id))?.assignedAt || (String(job.appointment?.assignedTechnician) === String(job.technician?._id) ? appointmentAssignmentTime(job.appointment) : null) })),
        ...appointments.filter(item => !linkedAppointmentIds.has(String(item._id))).map(item => ({ id: String(item._id), recordType: 'appointment', canAssign: true, reference: item.appointmentNumber || `APT-${String(item._id).slice(-8).toUpperCase()}`, status: item.status, priority: 'Normal', customer: item.customer?.name || 'Customer unavailable', vehicle: item.vehicle ? `${item.vehicle.make} ${item.vehicle.model}` : 'Vehicle unavailable', registrationNumber: item.vehicle?.registrationNumber || '', serviceType: item.serviceType, technicianId: item.assignedTechnician ? String(item.assignedTechnician._id) : '', technician: item.assignedTechnician?.name || '', availabilityStatus: item.assignedTechnician?.availabilityStatus || '', preferredDate: item.preferredDate, preferredTime: item.preferredTime, createdAt: item.createdAt, assignedAt: appointmentAssignmentTime(item) })),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      technicians: technicians.map(person => ({ id: String(person._id), name: person.name, email: person.email, specialization: person.technicianSpecialization || 'Not set', availabilityStatus: person.availabilityStatus || 'Available', pendingAppointments: pending.get(String(person._id)) || 0, activeJobs: workload.get(String(person._id)) || 0, assignedToday: assignments.get(String(person._id)) || 0 })),
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
      const appointment = job.appointment ? await Appointment.findById(job.appointment).select('preferredDate preferredTime') : null;
      const conflict = await technicianAssignmentConflict(nextId, { jobId: job._id, appointmentId: job.appointment, preferredDate: appointment?.preferredDate, preferredTime: appointment?.preferredTime });
      if (conflict) return res.status(409).json({ message: conflict });
    }
    const action = !nextId ? 'Removed' : previousId ? 'Reassigned' : 'Assigned';
    const previousTechnicianId = job.technician;
    job.technician = nextTechnician?._id;
    job.technicianAssignments.push({ technician: nextTechnician?._id || previousTechnicianId, assignedBy: req.user._id, assignedAt: new Date(), action });
    // Persist the changes made to job above; document validation and registered save hooks run here.
    await job.save();
    if (job.appointment) {
      const appointmentUpdate = nextTechnician?._id
        ? { $set: { assignedTechnician: nextTechnician._id, technicianAssignedAt: job.technicianAssignments.at(-1).assignedAt } }
        : { $unset: { assignedTechnician: 1, technicianAssignedAt: 1 } };
      // Apply the specified appointment database changes only to records matching this filter.
      await Appointment.updateOne({ _id: job.appointment }, appointmentUpdate);
    }
    if (previousId && previousId !== nextId) await Notification.create({ user: previousId, type: 'ServiceJobUnassigned', title: 'Service job assignment changed', message: `${job.serviceNumber} is no longer assigned to you.`, link: '/technician/jobs' }).catch(() => {});
    if (nextId) await Notification.create({ user: nextId, type: 'ServiceJobAssigned', title: action === 'Reassigned' ? 'Service job reassigned' : 'New service job assigned', message: `${job.serviceNumber} has been ${action.toLowerCase()} to you.`, link: '/technician/jobs' }).catch(() => {});
    res.set('Cache-Control', 'private, no-store').json({ id: String(job._id), technicianId: nextId, technician: nextTechnician?.name || '', action, assignedAt: job.technicianAssignments.at(-1)?.assignedAt || null });
  } catch { res.status(503).json({ message: 'Unable to update the service job assignment.' }); }
}
