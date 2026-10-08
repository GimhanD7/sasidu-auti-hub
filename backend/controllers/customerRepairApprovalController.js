import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import ServiceJob from '../models/ServiceJob.js';
import User from '../models/User.js';

export async function listCustomerRepairApprovals(req, res) {
  try {
    const jobs = await ServiceJob.find({ customer: req.user._id, 'additionalRepairs.0': { $exists: true } })
      .sort({ updatedAt: -1 })
      .populate({ path: 'vehicle', select: 'make model year registrationNumber' })
      .lean();
    const requests = jobs.flatMap(job => (job.additionalRepairs || []).map(repair => ({
      id: String(repair._id),
      jobId: String(job._id),
      serviceNumber: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`,
      jobStatus: job.status,
      vehicle: job.vehicle ? `${job.vehicle.year ? `${job.vehicle.year} ` : ''}${job.vehicle.make} ${job.vehicle.model}${job.vehicle.registrationNumber ? ` · ${job.vehicle.registrationNumber}` : ''}` : 'Vehicle details unavailable',
      problem: repair.description || '',
      technicianExplanation: repair.technicianExplanation || repair.description || '',
      photos: (repair.photos || []).filter(url => /^https?:\/\//i.test(url)),
      parts: (repair.parts || []).map(part => ({ name: part.name || 'Part', quantity: part.quantity ?? null, unitCost: part.unitCost ?? null, totalCost: part.totalCost ?? (part.unitCost != null && part.quantity != null ? part.unitCost * part.quantity : null) })),
      labourCost: repair.labourCost ?? null,
      estimatedCost: repair.estimatedCost ?? null,
      status: repair.status || 'Pending',
      requestedAt: repair.requestedAt || job.createdAt,
      customerComment: repair.customerComment || '',
      decisionAt: repair.decisionAt || null,
    })));
    res.set('Cache-Control', 'private, no-store').json(requests);
  } catch {
    res.status(503).json({ message: 'Unable to load repair approval requests. Please try again.' });
  }
}

export async function decideCustomerRepairApproval(req, res) {
  const { jobId, repairId } = req.params;
  const { decision, comment = '' } = req.body || {};
  if (!mongoose.isValidObjectId(jobId) || !mongoose.isValidObjectId(repairId)) return res.status(400).json({ message: 'Invalid repair approval request.' });
  if (!['Approved', 'Rejected'].includes(decision)) return res.status(400).json({ message: 'Choose Approved or Rejected.' });
  if (typeof comment !== 'string' || comment.length > 1000) return res.status(400).json({ message: 'Comments must be 1,000 characters or fewer.' });

  try {
    const job = await ServiceJob.findOne({ _id: jobId, customer: req.user._id });
    if (!job) return res.status(404).json({ message: 'Repair approval request not found.' });
    const repair = job.additionalRepairs.id(repairId);
    if (!repair) return res.status(404).json({ message: 'Repair approval request not found.' });
    if (repair.status !== 'Pending') return res.status(409).json({ message: `This request has already been ${repair.status.toLowerCase()}.` });

    const decisionAt = new Date();
    repair.status = decision;
    repair.customerComment = comment.trim();
    repair.decisionAt = decisionAt;
    if (job.status === 'Waiting for Approval' && !job.additionalRepairs.some(item => item.status === 'Pending')) {
      job.status = 'In Progress';
      job.$locals.suppressCustomerStatusNotifications = true;
    }
    job.timeline.push({ status: `Additional repair ${decision.toLowerCase()}`, timestamp: decisionAt, notes: `${repair.description || 'Additional repair'}${comment.trim() ? ` — Customer: ${comment.trim()}` : ''}` });
    await job.save();

    let notified = true;
    try {
      const actorName = req.user.name || req.user.email || 'The customer';
      const title = `Additional repair ${decision.toLowerCase()}`;
      const message = `${actorName} ${decision.toLowerCase()} the additional repair for ${job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`}.`;
      const notifications = [];
      if (job.technician) notifications.push({ user: job.technician, type: 'RepairApprovalDecision', title, message, link: '/technician/jobs' });
      const admins = await User.find({ role: { $in: ['Admin', 'admin'] }, isActive: { $ne: false } }).select('_id').lean();
      for (const admin of admins) notifications.push({ user: admin._id, type: 'RepairApprovalDecision', title, message, link: '/admin/kanban' });
      if (notifications.length) await Notification.insertMany(notifications, { ordered: false });
    } catch { notified = false; /* The saved decision remains authoritative if notification delivery is temporarily unavailable. */ }

    return res.json({ id: String(repair._id), status: repair.status, customerComment: repair.customerComment, decisionAt, jobStatus: job.status, notified });
  } catch {
    return res.status(503).json({ message: 'Unable to save your decision. Please try again.' });
  }
}
