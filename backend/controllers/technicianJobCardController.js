import mongoose from 'mongoose';
import ServiceJob from '../models/ServiceJob.js';
import JobPhoto from '../models/JobPhoto.js';

const MAX_PHOTO_BYTES = 1.4 * 1024 * 1024;
const NEXT_STATUS = { Inspecting: ['In Progress'], 'In Progress': ['Final Test'], 'Final Test': ['Ready'] };
const text = (value, max, label, { required = false } = {}) => {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const normalized = value.trim();
  if (normalized.length > max || (required && !normalized)) throw new Error(`${label} is required and must be ${max} characters or fewer.`);
  return normalized;
};
const textList = (value, label) => {
  if (!Array.isArray(value) || value.length > 30) throw new Error(`${label} must contain no more than 30 items.`);
  return value.map(item => text(item, 500, label, { required: true }));
};

async function findAssignedJob(jobId, technicianId) {
  if (!mongoose.isValidObjectId(jobId)) return null;
  return ServiceJob.findOne({ _id: jobId, technician: technicianId });
}

export async function updateTechnicianJobCard(req, res) {
  const { action } = req.body || {};
  if (typeof action !== 'string') return res.status(400).json({ message: 'Choose a job card update.' });
  try {
    const job = await findAssignedJob(req.params.jobId, req.user._id);
    if (!job) return res.status(404).json({ message: 'Assigned service job not found.' });
    const now = new Date();
    let message;

    if (action === 'inspectionStart') {
      if (job.status !== 'Inspecting') return res.status(409).json({ message: 'Inspection can only be started while this job is in Inspecting status.' });
      if (job.inspection?.startedAt) return res.status(409).json({ message: 'Inspection has already been started.' });
      job.inspection ||= {};
      job.inspection.startedAt = now;
      job.timeline.push({ status: 'Inspection Started', timestamp: now, notes: `Inspection started by ${req.user.name || 'technician'}.` });
      message = 'Inspection started.';
    } else if (action === 'inspection') {
      const current = job.inspection?.toObject?.() || job.inspection || {};
      if (job.status !== 'Inspecting') return res.status(409).json({ message: 'Inspection details can only be changed while the job is in Inspecting status.' });
      if (!current.startedAt) return res.status(409).json({ message: 'Start the inspection before saving inspection details.' });
      if (current.completedAt) return res.status(409).json({ message: 'This inspection has already been completed.' });
      const findings = text(req.body.findings ?? current.findings ?? '', 5000, 'Inspection findings');
      const diagnosis = text(req.body.diagnosis ?? current.diagnosis ?? '', 5000, 'Diagnosis');
      if (req.body.complete === true && (!findings || !diagnosis)) return res.status(400).json({ message: 'Enter inspection findings and a diagnosis before completing the inspection.' });
      job.inspection = {
        ...current,
        findings,
        diagnosis,
        notes: text(req.body.notes ?? current.notes ?? '', 5000, 'Inspection notes'),
        issues: req.body.issues === undefined ? current.issues || [] : textList(req.body.issues, 'Issues'),
        recommendedRepairs: req.body.recommendedRepairs === undefined ? current.recommendedRepairs || [] : textList(req.body.recommendedRepairs, 'Recommended repairs'),
        ...(req.body.complete === true ? { completedAt: now } : {}),
      };
      if (req.body.complete === true) job.timeline.push({ status: 'Inspection Completed', timestamp: now, notes: 'Vehicle inspection completed.' });
      message = req.body.complete === true ? 'Inspection saved and completed.' : 'Inspection details saved.';
    } else if (action === 'repairNote') {
      const note = text(req.body.note, 2000, 'Repair note', { required: true });
      job.repairNotes.push({ note, technician: req.user._id, createdAt: now });
      message = 'Repair note added.';
    } else if (action === 'taskAdd') {
      const title = text(req.body.title, 200, 'Task', { required: true });
      const notes = text(req.body.notes || '', 1000, 'Task notes');
      job.tasks.push({ title, notes, status: 'Pending' });
      message = 'Repair task added.';
    } else if (action === 'taskUpdate') {
      if (!mongoose.isValidObjectId(req.body.taskId)) return res.status(400).json({ message: 'Choose a valid repair task.' });
      const task = job.tasks.id(req.body.taskId);
      if (!task) return res.status(404).json({ message: 'Repair task not found.' });
      if (!['Pending', 'In Progress', 'Complete'].includes(req.body.status)) return res.status(400).json({ message: 'Choose a valid task status.' });
      task.status = req.body.status;
      if (req.body.notes !== undefined) task.notes = text(req.body.notes, 1000, 'Task notes');
      task.completedAt = task.status === 'Complete' ? now : undefined;
      message = 'Repair task updated.';
    } else if (action === 'partAdd') {
      const name = text(req.body.name, 200, 'Part name', { required: true });
      const partNumber = text(req.body.partNumber || '', 100, 'Part number');
      const quantity = Number(req.body.quantity);
      const unitCost = Number(req.body.unitCost);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000 || !Number.isFinite(unitCost) || unitCost < 0 || unitCost > 100000000) return res.status(400).json({ message: 'Enter a valid part quantity and unit price.' });
      job.replacedParts.push({ name, partNumber, quantity, unitCost, replacedAt: now });
      message = 'Part recorded on this job.';
    } else if (action === 'labourAdd') {
      const description = text(req.body.description || 'Repair labour', 200, 'Labour description');
      const hours = Number(req.body.hours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return res.status(400).json({ message: 'Labour time must be greater than 0 and no more than 24 hours.' });
      job.labourEntries.push({ description, minutes: Math.round(hours * 60), technician: req.user._id, recordedAt: now });
      message = 'Labour time recorded.';
    } else if (action === 'approvalRequest') {
      const description = text(req.body.description, 2000, 'Additional repair description', { required: true });
      const technicianExplanation = text(req.body.explanation || '', 3000, 'Repair explanation');
      const estimatedCost = Number(req.body.estimatedCost);
      const labourCost = Number(req.body.labourCost || 0);
      if (!Number.isFinite(estimatedCost) || estimatedCost < 0 || estimatedCost > 100000000 || !Number.isFinite(labourCost) || labourCost < 0 || labourCost > 100000000) return res.status(400).json({ message: 'Enter valid estimated parts and labour costs.' });
      if (job.status === 'Waiting for Approval' || job.additionalRepairs.some(repair => repair.status === 'Pending')) return res.status(409).json({ message: 'This job already has a pending customer approval request.' });
      if (!['Inspecting', 'In Progress'].includes(job.status)) return res.status(409).json({ message: 'Customer approval can only be requested while inspecting or repairing the vehicle.' });
      job.additionalRepairs.push({ description, technicianExplanation, estimatedCost, labourCost, status: 'Pending', requestedAt: now });
      job.status = 'Waiting for Approval';
      job.timeline.push({ status: 'Waiting for Approval', timestamp: now, notes: `Customer approval requested: ${description}` });
      message = 'Customer approval requested.';
    } else if (action === 'status') {
      const nextStatus = req.body.status;
      if (job.status === 'Waiting for Approval' || !NEXT_STATUS[job.status]?.includes(nextStatus)) return res.status(409).json({ message: 'This job cannot move to that status yet.' });
      if (nextStatus === 'In Progress' && !job.inspection?.completedAt) return res.status(409).json({ message: 'Complete the vehicle inspection before starting repairs.' });
      if (nextStatus === 'Final Test' && job.tasks.some(task => task.status !== 'Complete')) return res.status(409).json({ message: 'Complete all repair tasks before moving this job to final test.' });
      job.status = nextStatus;
      job.timeline.push({ status: nextStatus, timestamp: now, notes: text(req.body.notes || '', 1000, 'Status note') || `Status updated by ${req.user.name || 'technician'}.` });
      message = `Job status updated to ${nextStatus}.`;
    } else return res.status(400).json({ message: 'Choose a supported job card update.' });

    await job.save();
    return res.json({ message, status: job.status });
  } catch (error) {
    if (error.message?.includes('must be') || error.message?.includes(' is required')) return res.status(400).json({ message: error.message });
    return res.status(503).json({ message: 'Unable to save this job card update. Please try again.' });
  }
}

function photoSignatureMatches(buffer, contentType) {
  if (contentType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (contentType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (contentType === 'image/webp') return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

export async function uploadTechnicianJobPhoto(req, res) {
  const { filename, contentType, data } = req.body || {};
  const category = req.body?.category || 'Job';
  if (typeof filename !== 'string' || typeof contentType !== 'string' || typeof data !== 'string' || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return res.status(400).json({ message: 'Choose a JPEG, PNG, or WebP photo.' });
  if (!['Job', 'Inspection', 'RepairEvidence'].includes(category)) return res.status(400).json({ message: 'Choose a valid photo category.' });
  const base64 = data.replace(/^data:image\/(?:jpeg|png|webp);base64,/i, '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) return res.status(400).json({ message: 'The selected photo is invalid.' });
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > MAX_PHOTO_BYTES || !photoSignatureMatches(buffer, contentType)) return res.status(400).json({ message: 'Photo must be a valid JPEG, PNG, or WebP file up to 1.4 MB.' });
  try {
    const job = await findAssignedJob(req.params.jobId, req.user._id);
    if (!job) return res.status(404).json({ message: 'Assigned service job not found.' });
    const count = await JobPhoto.countDocuments({ job: job._id });
    if (count >= 12) return res.status(409).json({ message: 'This job already has the maximum of 12 photos.' });
    const safeFilename = filename.replace(/[\\/\u0000-\u001f]/g, '_').trim().slice(0, 160) || 'job-photo';
    if (category === 'Inspection' && !job.inspection?.startedAt) return res.status(409).json({ message: 'Start the inspection before uploading inspection images.' });
    if (category === 'Inspection' && (job.status !== 'Inspecting' || job.inspection?.completedAt)) return res.status(409).json({ message: 'Inspection images can only be added before the inspection is completed.' });
    const photo = await JobPhoto.create({ job: job._id, uploadedBy: req.user._id, filename: safeFilename, contentType, category, data: buffer });
    return res.status(201).json({ photo: { id: String(photo._id), filename: photo.filename, contentType: photo.contentType, category: photo.category, createdAt: photo.createdAt } });
  } catch { return res.status(503).json({ message: 'Unable to upload this job photo. Please try again.' }); }
}

export async function getTechnicianJobPhoto(req, res) {
  try {
    const job = await findAssignedJob(req.params.jobId, req.user._id);
    if (!job) return res.status(404).json({ message: 'Service job photo not found.' });
    const photo = await JobPhoto.findOne({ _id: req.params.photoId, job: job._id }).lean();
    if (!photo) return res.status(404).json({ message: 'Service job photo not found.' });
    res.set({ 'Content-Type': photo.contentType, 'Content-Length': photo.data.length, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    return res.send(photo.data);
  } catch { return res.status(503).json({ message: 'Unable to load this job photo.' }); }
}
