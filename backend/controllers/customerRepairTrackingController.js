import ServiceJob from '../models/ServiceJob.js';

const TRACKED_STATUSES = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test', 'Ready'];

export async function listCustomerRepairTracking(req, res) {
  try {
    const jobs = await ServiceJob.find({ customer: req.user._id, status: { $in: TRACKED_STATUSES } })
      .sort({ createdAt: -1 })
      .populate({ path: 'vehicle', select: 'make model year registrationNumber imageUrl' })
      .populate({ path: 'technician', select: 'name' })
      .populate({ path: 'appointment', select: 'serviceType problemDescription' })
      .lean();
    res.set('Cache-Control', 'private, no-store').json(jobs.map(job => ({
      id: job._id,
      serviceNumber: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`,
      status: job.status,
      priority: job.priority,
      expectedCompletionTime: job.expectedCompletionTime || null,
      updatedAt: job.updatedAt,
      createdAt: job.createdAt,
      technician: job.technician?.name || null,
      vehicle: job.vehicle ? {
        id: job.vehicle._id,
        make: job.vehicle.make,
        model: job.vehicle.model,
        year: job.vehicle.year || null,
        registrationNumber: job.vehicle.registrationNumber,
        imageUrl: job.vehicle.imageUrl || null,
      } : null,
      serviceType: job.appointment?.serviceType || 'Service repair',
      customerComplaint: job.appointment?.problemDescription || '',
      timeline: (job.timeline || []).slice().sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)).map(event => ({
        status: event.status || 'Workshop update',
        timestamp: event.timestamp || null,
        notes: event.notes || '',
      })),
      tasks: (job.tasks || []).map(task => ({
        id: task._id,
        title: task.title,
        status: task.status,
        notes: task.notes || '',
        completedAt: task.completedAt || null,
      })),
    })));
  } catch {
    res.status(503).json({ message: 'Unable to load repair tracking. Please try again.' });
  }
}
