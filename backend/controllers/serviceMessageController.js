import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import ServiceJob from '../models/ServiceJob.js';
import ServiceMessage from '../models/ServiceMessage.js';
import User from '../models/User.js';
import { normalizeRole } from '../utils/session.js';

function canAccessJob(user, job) {
  const role = normalizeRole(user.role);
  if (role === 'Customer') return String(job.customer) === String(user._id);
  if (role === 'Admin') return true;
  if (role === 'Technician') return String(job.technician) === String(user._id);
  return false;
}

function vehicleName(vehicle) {
  if (!vehicle) return 'Vehicle details unavailable';
  return `${vehicle.year ? `${vehicle.year} ` : ''}${vehicle.make} ${vehicle.model}${vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ''}`;
}

export async function listMessageThreads(req, res) {
  try {
    const role = normalizeRole(req.user.role);
    const filter = role === 'Customer' ? { customer: req.user._id }
      : role === 'Admin' ? {}
        : role === 'Technician' ? { technician: req.user._id } : null;
    if (!filter) return res.status(403).json({ message: 'Access denied.' });
    const jobs = await ServiceJob.find(filter).sort({ updatedAt: -1 })
      .populate({ path: 'vehicle', select: 'make model year registrationNumber' })
      .populate({ path: 'customer', select: 'name' }).lean();
    if (!jobs.length) return res.set('Cache-Control', 'private, no-store').json([]);
    const jobIds = jobs.map(job => job._id);
    const [unreadRows, latestRows] = await Promise.all([
      ServiceMessage.aggregate([
        { $match: { serviceJob: { $in: jobIds }, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } } },
        { $group: { _id: '$serviceJob', count: { $sum: 1 } } },
      ]),
      ServiceMessage.aggregate([
        { $match: { serviceJob: { $in: jobIds } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$serviceJob', body: { $first: '$body' }, senderRole: { $first: '$senderRole' }, createdAt: { $first: '$createdAt' } } },
      ]),
    ]);
    const unread = new Map(unreadRows.map(row => [String(row._id), row.count]));
    const latest = new Map(latestRows.map(row => [String(row._id), row]));
    const threads = jobs.map(job => ({
      jobId: String(job._id),
      serviceNumber: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`,
      jobStatus: job.status,
      vehicle: vehicleName(job.vehicle),
      customerName: job.customer?.name || null,
      unreadCount: unread.get(String(job._id)) || 0,
      pendingApprovals: (job.additionalRepairs || []).filter(repair => (repair.status || 'Pending') === 'Pending').length,
      latestMessage: latest.get(String(job._id)) || null,
    }));
    res.set('Cache-Control', 'private, no-store').json(threads);
  } catch {
    res.status(503).json({ message: 'Unable to load your service conversations. Please try again.' });
  }
}

async function getAccessibleJob(req, res) {
  const { jobId } = req.params;
  if (!mongoose.isValidObjectId(jobId)) {
    res.status(400).json({ message: 'Invalid service job.' });
    return null;
  }
  const job = await ServiceJob.findById(jobId);
  if (!job) {
    res.status(404).json({ message: 'Service job not found.' });
    return null;
  }
  if (!canAccessJob(req.user, job)) {
    res.status(403).json({ message: 'You do not have access to this service conversation.' });
    return null;
  }
  return job;
}

export async function listServiceMessages(req, res) {
  try {
    const job = await getAccessibleJob(req, res);
    if (!job) return;
    const messages = await ServiceMessage.find({ serviceJob: job._id }).sort({ createdAt: 1 })
      .populate({ path: 'sender', select: 'name role' }).lean();
    res.set('Cache-Control', 'private, no-store').json(messages.map(message => ({
      id: String(message._id),
      body: message.body,
      senderId: String(message.sender?._id || message.sender),
      senderName: message.sender?.name || 'Workshop',
      senderRole: message.senderRole,
      createdAt: message.createdAt,
      isRead: (message.readBy || []).some(id => String(id) === String(req.user._id)),
    })));
  } catch {
    res.status(503).json({ message: 'Unable to load this conversation. Please try again.' });
  }
}

export async function sendServiceMessage(req, res) {
  const body = req.body?.body;
  if (typeof body !== 'string' || !body.trim() || body.trim().length > 2000) {
    return res.status(400).json({ message: 'Enter a message of 1 to 2,000 characters.' });
  }
  try {
    const job = await getAccessibleJob(req, res);
    if (!job) return;
    const senderRole = normalizeRole(req.user.role);
    if (!['Customer', 'Admin', 'Technician'].includes(senderRole)) return res.status(403).json({ message: 'Access denied.' });
    const message = await ServiceMessage.create({
      serviceJob: job._id,
      customer: job.customer,
      sender: req.user._id,
      senderRole,
      body: body.trim(),
      readBy: [req.user._id],
    });

    let notified = true;
    try {
      let recipients = [];
      if (senderRole === 'Customer') {
        if (job.technician && String(job.technician) !== String(req.user._id)) recipients.push({ user: job.technician, link: '/technician/messages' });
        const admins = await User.find({ role: { $in: ['Admin', 'admin'] }, isActive: { $ne: false }, _id: { $ne: req.user._id } }).select('_id').lean();
        recipients.push(...admins.map(admin => ({ user: admin._id, link: '/admin/messages' })));
      } else {
        recipients = [{ user: job.customer, link: '/customer/messages' }];
      }
      const preview = body.trim().length > 160 ? `${body.trim().slice(0, 157)}…` : body.trim();
      if (recipients.length) await Notification.insertMany(recipients.map(recipient => ({
        user: recipient.user,
        type: 'NewServiceMessage',
        title: 'New service message',
        message: preview,
        link: `${recipient.link}?job=${job._id}`,
      })), { ordered: false });
    } catch { notified = false; }

    return res.status(201).json({
      id: String(message._id), body: message.body, senderId: String(req.user._id),
      senderName: req.user.name, senderRole, createdAt: message.createdAt, isRead: true, notified,
    });
  } catch {
    return res.status(503).json({ message: 'Unable to send your message. Please try again.' });
  }
}

export async function markServiceMessagesRead(req, res) {
  try {
    const job = await getAccessibleJob(req, res);
    if (!job) return;
    const result = await ServiceMessage.updateMany(
      { serviceJob: job._id, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } },
    );
    res.json({ markedRead: result.modifiedCount });
  } catch {
    res.status(503).json({ message: 'Unable to mark messages as read. Please try again.' });
  }
}
