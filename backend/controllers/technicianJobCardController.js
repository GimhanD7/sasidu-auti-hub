import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import ServiceJob from '../models/ServiceJob.js';
import JobPhoto from '../models/JobPhoto.js';
import Invoice from '../models/Invoice.js';
import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

const MAX_PHOTO_BYTES = 1.4 * 1024 * 1024;
const NEXT_STATUS = { Inspecting: ['In Progress'], 'In Progress': ['Final Test'], 'Final Test': ['Ready'] };
const DIAGNOSTIC_CATEGORIES = ['Engine', 'Transmission', 'Brakes', 'Electrical', 'Suspension', 'Cooling', 'Exhaust', 'Tyres', 'Body', 'Other'];
const DIAGNOSTIC_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const LABOUR_TYPES = ['Inspection', 'Diagnostics', 'Repair', 'Testing', 'Other'];
const FINAL_TEST_ITEMS = ['Brakes', 'Steering', 'Lights and signals', 'Tyres and wheels', 'Fluid leaks', 'Road test'];
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
    if (job.status === 'Ready') return res.status(409).json({ message: 'This service is completed and cannot be changed.' });
    const now = new Date();
    let message;

    if (action === 'inspectionStart') {
      if (job.status !== 'Inspecting') return res.status(409).json({ message: 'Inspection can only be started while this job is in Inspecting status.' });
      if (job.inspection?.startedAt) return res.status(409).json({ message: 'Inspection has already been started.' });
      job.inspection ||= {};
      job.inspection.startedAt = now;
      job.timeline.push({ status: 'Inspection Started', timestamp: now, actor: req.user._id, notes: `Inspection started by ${req.user.name || 'technician'}.` });
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
      if (req.body.complete === true) job.timeline.push({ status: 'Inspection Completed', timestamp: now, actor: req.user._id, notes: 'Vehicle inspection completed.' });
      message = req.body.complete === true ? 'Inspection saved and completed.' : 'Inspection details saved.';
    } else if (action === 'diagnosticReport') {
      const result = text(req.body.result, 5000, 'Diagnostic result', { required: true });
      const issueCategory = req.body.issueCategory;
      const faultDescription = text(req.body.faultDescription, 5000, 'Fault description', { required: true });
      const recommendedAction = text(req.body.recommendedAction, 5000, 'Recommended action', { required: true });
      const severity = req.body.severity;
      const estimatedRepairHours = Number(req.body.estimatedRepairHours);
      if (!DIAGNOSTIC_CATEGORIES.includes(issueCategory)) return res.status(400).json({ message: 'Choose a valid issue category.' });
      if (!DIAGNOSTIC_SEVERITIES.includes(severity)) return res.status(400).json({ message: 'Choose a valid severity.' });
      if (!Number.isFinite(estimatedRepairHours) || estimatedRepairHours <= 0 || estimatedRepairHours > 168) return res.status(400).json({ message: 'Estimated repair time must be greater than 0 and no more than 168 hours.' });
      const estimatedRepairMinutes = Math.round(estimatedRepairHours * 60);
      job.diagnosticReport = { result, issueCategory, faultDescription, recommendedAction, severity, estimatedRepairMinutes, technician: req.user._id, updatedAt: now };
      job.timeline.push({ status: 'Diagnostic Report Updated', timestamp: now, actor: req.user._id, notes: `${issueCategory} diagnosis recorded · ${severity} severity.` });
      message = 'Diagnostic report saved.';
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
      if (!['Pending', 'In Progress', 'Complete', 'Cancelled'].includes(req.body.status)) return res.status(400).json({ message: 'Choose a valid task status.' });
      if (req.body.title !== undefined) task.title = text(req.body.title, 200, 'Task title', { required: true });
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
    } else if (action === 'partRemove') {
      if (!mongoose.isValidObjectId(req.body.partId)) return res.status(400).json({ message: 'Choose a valid part entry.' });
      const part = job.replacedParts.id(req.body.partId);
      if (!part) return res.status(404).json({ message: 'Part entry not found.' });
      job.replacedParts.pull(req.body.partId);
      message = 'Part entry removed from this job.';
    } else if (action === 'labourAdd') {
      const description = text(req.body.description || 'Service labour', 200, 'Labour description');
      const labourType = req.body.labourType || 'Repair';
      if (!LABOUR_TYPES.includes(labourType)) return res.status(400).json({ message: 'Choose a valid labour type.' });

      let hours = req.body.hours !== undefined && req.body.hours !== '' ? Number(req.body.hours) : null;
      let ratePerHour = req.body.ratePerHour !== undefined && req.body.ratePerHour !== '' ? Number(req.body.ratePerHour) : null;
      const directAmount = req.body.amount !== undefined && req.body.amount !== '' ? Number(req.body.amount) : null;

      if (directAmount !== null) {
        if (!Number.isFinite(directAmount) || directAmount < 0 || directAmount > 100000000) {
          return res.status(400).json({ message: 'Enter a valid service charge amount.' });
        }
        hours = 1;
        ratePerHour = directAmount;
      } else {
        if (!Number.isFinite(hours) || hours <= 0 || hours > 24 || !Number.isFinite(ratePerHour) || ratePerHour < 0 || ratePerHour > 100000000) {
          return res.status(400).json({ message: 'Enter valid labour time and hourly rate, or a direct service amount.' });
        }
      }

      job.labourEntries.push({ description, labourType, minutes: Math.max(1, Math.round(hours * 60)), ratePerHour, technician: req.user._id, recordedAt: now });
      message = 'Labour / service charge recorded.';
    } else if (action === 'labourRemove') {
      if (!mongoose.isValidObjectId(req.body.labourId)) return res.status(400).json({ message: 'Choose a valid labour entry.' });
      const entry = job.labourEntries.id(req.body.labourId);
      if (!entry) return res.status(404).json({ message: 'Labour entry not found.' });
      job.labourEntries.pull(req.body.labourId);
      message = 'Labour entry removed from this job.';
    } else if (action === 'labourTimerStart') {
      if (job.activeLabourTimer?.startedAt) return res.status(409).json({ message: 'A labour timer is already running for this job.' });
      const description = text(req.body.description || 'Repair labour', 200, 'Labour description');
      const labourType = req.body.labourType || 'Repair';
      const ratePerHour = Number(req.body.ratePerHour ?? 0);
      if (!LABOUR_TYPES.includes(labourType)) return res.status(400).json({ message: 'Choose a valid labour type.' });
      if (!Number.isFinite(ratePerHour) || ratePerHour < 0 || ratePerHour > 100000000) return res.status(400).json({ message: 'Enter a valid hourly rate.' });
      job.activeLabourTimer = { description, labourType, ratePerHour, technician: req.user._id, startedAt: now };
      message = 'Labour timer started.';
    } else if (action === 'labourTimerStop') {
      const timer = job.activeLabourTimer;
      if (!timer?.startedAt) return res.status(409).json({ message: 'There is no running labour timer for this job.' });
      if (String(timer.technician) !== String(req.user._id)) return res.status(403).json({ message: 'Only the technician who started this timer can stop it.' });
      const minutes = Math.ceil((now - new Date(timer.startedAt)) / 60000);
      if (minutes > 1440) return res.status(409).json({ message: 'This timer exceeded 24 hours. Ask a manager to correct the labour entry.' });
      job.labourEntries.push({ description: timer.description, labourType: timer.labourType, minutes: Math.max(1, minutes), ratePerHour: timer.ratePerHour, technician: timer.technician, startedAt: timer.startedAt, endedAt: now, recordedAt: now });
      job.activeLabourTimer = undefined;
      message = 'Labour timer stopped and time recorded.';
    } else if (action === 'finalTestStart') {
      if (job.status !== 'Final Test') return res.status(409).json({ message: 'A final test can only start while the job is in Final Test status.' });
      job.finalTest = { startedAt: now, notes: '', unresolvedIssue: '', checklist: [] };
      job.timeline.push({ status: 'Final Test Started', timestamp: now, actor: req.user._id, notes: 'Final vehicle checks started.' });
      message = 'Final test started.';
    } else if (action === 'finalTestComplete') {
      if (job.status !== 'Final Test' || !job.finalTest?.startedAt || job.finalTest?.completedAt) return res.status(409).json({ message: 'Start or restart the final test before recording its results.' });
      const checklist = req.body.checklist;
      if (!Array.isArray(checklist) || checklist.length !== FINAL_TEST_ITEMS.length || new Set(checklist.map(item => item?.item)).size !== FINAL_TEST_ITEMS.length || FINAL_TEST_ITEMS.some(item => !checklist.some(entry => entry?.item === item && ['Passed', 'Failed'].includes(entry.result)))) return res.status(400).json({ message: 'Complete every final test checklist item with Passed or Failed.' });
      const normalizedChecklist = checklist.map(entry => ({ item: entry.item, result: entry.result, notes: text(entry.notes || '', 500, 'Checklist note') }));
      const notes = text(req.body.notes || '', 2000, 'Final test notes');
      const unresolvedIssue = text(req.body.unresolvedIssue || '', 2000, 'Unresolved issue');
      const failedChecks = normalizedChecklist.filter(entry => entry.result === 'Failed');
      const passed = failedChecks.length === 0 && !unresolvedIssue;
      job.finalTest.checklist = normalizedChecklist;
      job.finalTest.notes = notes;
      job.finalTest.unresolvedIssue = unresolvedIssue;
      job.finalTest.result = passed ? 'Passed' : 'Failed';
      job.finalTest.completedAt = now;
      if (passed) {
        job.timeline.push({ status: 'Final Test Passed', timestamp: now, actor: req.user._id, notes: notes || 'All final test checks passed.' });
        message = 'Final test passed. This vehicle can be marked Ready.';
      } else {
        const failureSummary = [failedChecks.map(item => item.item).join(', '), unresolvedIssue].filter(Boolean).join(' — ');
        const customerUpdate = `Final testing found an issue: ${failureSummary}.${notes ? ` ${notes}` : ''}`;
        job.$locals.statusTransitionFrom = job.status;
        job.status = 'In Progress';
        job.timeline.push({ status: 'Final Test Failed', timestamp: now, actor: req.user._id, notes: customerUpdate });
        job.timeline.push({ status: 'In Progress', timestamp: now, actor: req.user._id, notes: customerUpdate });
        message = 'Final test failed. The job returned to In Progress for further repair.';
      }
    } else if (action === 'completeJob') {
      if (!['In Progress', 'Inspecting', 'Final Test'].includes(job.status)) return res.status(409).json({ message: 'Start the service before completing it.' });
      if (job.tasks.some(task => !['Complete', 'Cancelled'].includes(task.status))) return res.status(409).json({ message: 'Complete or cancel all repair tasks before completing this job.' });
      if (job.additionalRepairs.some(repair => repair.status === 'Pending')) return res.status(409).json({ message: 'Resolve all pending customer approvals before completing this job.' });
      if (job.activeLabourTimer?.startedAt) return res.status(409).json({ message: 'Stop the active labour timer before completing this job.' });
      const reportNotes = text(req.body.reportNotes, 3000, 'Final technician report', { required: true });
      const parts = (job.replacedParts || []).map(part => ({ name: part.name || 'Part', partNumber: part.partNumber || '', quantity: Number(part.quantity) || 0, unitPrice: Number(part.unitCost) || 0, total: Math.round((Number(part.quantity) || 0) * (Number(part.unitCost) || 0) * 100) / 100 }));
      const labourItems = (job.labourEntries || []).map(entry => ({ description: `${entry.labourType || 'Repair'} · ${entry.description || 'Labour'}`, hours: Math.round((Number(entry.minutes) || 0) / 60 * 100) / 100, rate: Number(entry.ratePerHour) || 0, total: Math.round(((Number(entry.minutes) || 0) / 60) * (Number(entry.ratePerHour) || 0) * 100) / 100 }));
      const partsCost = Math.round(parts.reduce((sum, part) => sum + part.total, 0) * 100) / 100;
      const labourCost = Math.round(labourItems.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
      const additionalRepairsCost = Math.round(job.additionalRepairs.filter(repair => repair.status === 'Approved').reduce((sum, repair) => sum + (Number(repair.estimatedCost) || 0), 0) * 100) / 100;
      const totalAmount = Math.round((partsCost + labourCost + additionalRepairsCost) * 100) / 100;
      let invoice = await Invoice.findOne({ serviceJob: job._id, paymentStatus: { $ne: 'Cancelled' } });
      if (invoice) {
        invoice.parts = parts;
        invoice.labourItems = labourItems;
        invoice.partsCost = partsCost;
        invoice.labourCost = labourCost;
        invoice.additionalRepairsCost = additionalRepairsCost;
        const discount = invoice.discount || 0;
        const tax = invoice.tax || 0;
        invoice.totalAmount = Math.max(0, Math.round((partsCost + labourCost + additionalRepairsCost - discount + tax) * 100) / 100);
        await invoice.save();
      } else {
        invoice = await Invoice.create({
          serviceJob: job._id,
          customer: job.customer?._id || job.customer,
          invoiceNumber: `INV-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`,
          parts,
          labourItems,
          partsCost,
          labourCost,
          additionalRepairsCost,
          tax: 0,
          discount: 0,
          totalAmount,
          paymentStatus: 'Draft',
        });
      }
      job.finalReport = { notes: reportNotes, tasksVerified: true, partsVerified: true, labourVerified: true, technician: req.user._id, completedAt: now };
      job.billingInvoice = invoice._id;
      job.$locals.statusTransitionFrom = job.status;
      job.status = 'Ready';
      job.timeline.push({ status: 'Ready', timestamp: now, actor: req.user._id, notes: reportNotes });
      await job.save();
      if (job.appointment) await Appointment.updateOne({ _id: job.appointment }, { $set: { status: 'Completed' }, $unset: { bookingSlotKey: '' }, $push: { history: { action: 'Service completed', details: 'Technician completed the service and prepared billing.', actor: req.user._id, timestamp: now } } });
      try {
        const admins = await User.find({ role: { $in: ['Admin', 'admin'] }, isActive: { $ne: false } }).select('_id').lean();
        if (admins.length) await Notification.insertMany(admins.map(admin => ({ user: admin._id, type: 'ServiceJobCompleted', title: 'Service job completed', message: `${job.serviceNumber || 'A service job'} is ready. Draft invoice ${invoice.invoiceNumber} is available for billing review.`, link: '/admin/kanban', dedupeKey: `service-job-complete:${job._id}:${admin._id}` })), { ordered: false });
      } catch { /* Job completion and its draft billing record remain authoritative if admin notification delivery fails. */ }
      return res.json({ message: `Job completed, customer notified, and draft invoice ${invoice.invoiceNumber} sent to billing.`, status: job.status, invoice: { id: String(invoice._id), invoiceNumber: invoice.invoiceNumber, paymentStatus: invoice.paymentStatus, totalAmount: invoice.totalAmount } });
    } else if (action === 'approvalRequest') {
      const description = text(req.body.description, 2000, 'Additional repair description', { required: true });
      const technicianExplanation = text(req.body.explanation || '', 3000, 'Repair explanation');
      const labourCost = Number(req.body.labourCost ?? 0);
      const parts = req.body.parts ?? [];
      const photoIds = req.body.photoIds ?? [];
      const relatedTaskId = req.body.relatedTaskId || '';
      if (!Array.isArray(parts) || parts.length > 20) return res.status(400).json({ message: 'Add no more than 20 additional repair parts.' });
      if (!Array.isArray(photoIds) || photoIds.length > 3 || photoIds.some(id => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: 'Attach up to three valid supporting images.' });
      const normalizedParts = parts.map(part => {
        const name = text(part?.name, 200, 'Part name', { required: true });
        const quantity = Number(part.quantity);
        const unitCost = Number(part.unitCost);
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000 || !Number.isFinite(unitCost) || unitCost < 0 || unitCost > 100000000) throw new Error('Part quantity must be valid and unit price must be nonnegative.');
        return { name, quantity, unitCost, totalCost: Math.round(quantity * unitCost * 100) / 100 };
      });
      const partsCost = normalizedParts.reduce((sum, part) => sum + part.totalCost, 0);
      if (!Number.isFinite(labourCost) || labourCost < 0 || labourCost > 100000000) return res.status(400).json({ message: 'Enter a valid estimated labour cost.' });
      const estimatedCost = Math.round((partsCost + labourCost) * 100) / 100;
      if (!Number.isFinite(estimatedCost) || estimatedCost > 100000000) return res.status(400).json({ message: 'The estimated additional cost must not exceed 100,000,000.' });
      if (job.status === 'Waiting for Approval' || job.additionalRepairs.some(repair => repair.status === 'Pending')) return res.status(409).json({ message: 'This job already has a pending customer approval request.' });
      if (!['Inspecting', 'In Progress'].includes(job.status)) return res.status(409).json({ message: 'Customer approval can only be requested while inspecting or repairing the vehicle.' });
      if (photoIds.length) {
        const photos = await JobPhoto.find({ _id: { $in: photoIds }, job: job._id, category: 'RepairEvidence' }).select('_id').lean();
        if (photos.length !== new Set(photoIds.map(String)).size) return res.status(400).json({ message: 'Supporting images must be uploaded to this job first.' });
      }
      if (relatedTaskId && (!mongoose.isValidObjectId(relatedTaskId) || !job.tasks?.id?.(relatedTaskId))) return res.status(400).json({ message: 'Choose a task that belongs to this job.' });
      job.additionalRepairs.push({ description, technicianExplanation, parts: normalizedParts, estimatedCost, labourCost, photos: photoIds.map(String), relatedTask: relatedTaskId || undefined, status: 'Pending', requestedAt: now, requestedBy: req.user._id });
      job.status = 'Waiting for Approval';
      job.timeline.push({ status: 'Waiting for Approval', timestamp: now, actor: req.user._id, notes: `Customer approval requested: ${description}` });
      message = 'Customer approval requested.';
    } else if (action === 'status') {
      const nextStatus = req.body.status;
      if (job.status === 'Waiting for Approval' || !NEXT_STATUS[job.status]?.includes(nextStatus)) return res.status(409).json({ message: 'This job cannot move to that status yet.' });
      if (nextStatus === 'In Progress' && !job.inspection?.completedAt) return res.status(409).json({ message: 'Complete the vehicle inspection before starting repairs.' });
      if (nextStatus === 'Final Test' && job.tasks.some(task => !['Complete', 'Cancelled'].includes(task.status))) return res.status(409).json({ message: 'Complete or cancel all repair tasks before moving this job to final test.' });
      if (nextStatus === 'Ready') return res.status(409).json({ message: 'Use Complete Job to verify the final report and send billing information before marking this vehicle Ready.' });
      const customerUpdate = text(req.body.notes, 1000, 'Customer update', { required: true });
      job.$locals.statusTransitionFrom = job.status;
      job.status = nextStatus;
      job.timeline.push({ status: nextStatus, timestamp: now, actor: req.user._id, notes: customerUpdate });
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
  const evidenceType = req.body?.evidenceType || (category === 'RepairEvidence' ? 'Additional Repair' : 'General');
  let description;
  try { description = text(req.body?.description ?? '', 300, 'Photo description', { required: category === 'RepairEvidence' }); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  if (typeof filename !== 'string' || typeof contentType !== 'string' || typeof data !== 'string' || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return res.status(400).json({ message: 'Choose a JPEG, PNG, or WebP photo.' });
  if (!['Job', 'Inspection', 'RepairEvidence'].includes(category)) return res.status(400).json({ message: 'Choose a valid photo category.' });
  if (!['General', 'Before Repair', 'Damaged Part', 'After Repair', 'Additional Repair'].includes(evidenceType) || (category !== 'RepairEvidence' && evidenceType !== 'General')) return res.status(400).json({ message: 'Choose a valid repair evidence type.' });
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
    if (category === 'RepairEvidence' && evidenceType === 'Additional Repair' && !['Inspecting', 'In Progress'].includes(job.status)) return res.status(409).json({ message: 'Additional repair images can only be added while inspecting or repairing the vehicle.' });
    if (category === 'RepairEvidence' && evidenceType === 'After Repair' && !['In Progress', 'Final Test', 'Ready'].includes(job.status)) return res.status(409).json({ message: 'After-repair images can be added while repair or final testing is underway.' });
    if (category === 'RepairEvidence' && evidenceType !== 'Additional Repair' && evidenceType !== 'After Repair' && !['Inspecting', 'In Progress'].includes(job.status)) return res.status(409).json({ message: 'Before-repair and damaged-part images can only be added while inspecting or repairing the vehicle.' });
    const photo = await JobPhoto.create({ job: job._id, uploadedBy: req.user._id, filename: safeFilename, contentType, category, evidenceType, description, data: buffer });
    return res.status(201).json({ photo: { id: String(photo._id), filename: photo.filename, contentType: photo.contentType, category: photo.category, evidenceType: photo.evidenceType, description: photo.description, createdAt: photo.createdAt } });
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
