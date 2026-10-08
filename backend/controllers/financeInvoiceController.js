import { randomBytes } from 'node:crypto';
import Invoice from '../models/Invoice.js';
import ServiceJob from '../models/ServiceJob.js';

const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;
const jobPopulate = [
  { path: 'customer', select: 'name email mobile' },
  { path: 'vehicle', select: 'registrationNumber make model year' },
  { path: 'appointment', select: 'serviceType' },
  { path: 'billingInvoice', select: 'invoiceNumber paymentStatus totalAmount partsCost labourCost additionalRepairsCost tax discount parts labourItems' },
];

function buildInvoiceLines(job) {
  const parts = (job.replacedParts || []).map(part => {
    const quantity = Number(part.quantity) || 0;
    const unitPrice = Number(part.unitCost) || 0;
    return { name: part.name || 'Part', partNumber: part.partNumber || '', quantity, unitPrice, total: roundMoney(quantity * unitPrice) };
  });
  const labourItems = (job.labourEntries || []).map(item => {
    const hours = roundMoney((Number(item.minutes) || 0) / 60);
    const rate = Number(item.ratePerHour) || 0;
    return { description: item.description || item.labourType || 'Labour', hours, rate, total: roundMoney(hours * rate) };
  });
  const partsCost = roundMoney(parts.reduce((sum, part) => sum + part.total, 0));
  const labourCost = roundMoney(labourItems.reduce((sum, item) => sum + item.total, 0));
  const additionalRepairsCost = roundMoney((job.additionalRepairs || []).filter(repair => repair.status === 'Approved').reduce((sum, repair) => sum + (Number(repair.estimatedCost) || 0), 0));
  return { parts, labourItems, partsCost, labourCost, additionalRepairsCost };
}

function serializeJob(job) {
  const existing = job.billingInvoice;
  const lines = buildInvoiceLines(job);
  const subtotal = roundMoney(lines.partsCost + lines.labourCost + lines.additionalRepairsCost);
  return {
    id: String(job._id), serviceNumber: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`,
    customer: job.customer ? { name: job.customer.name, email: job.customer.email, mobile: job.customer.mobile || '' } : null,
    vehicle: job.vehicle ? { registrationNumber: job.vehicle.registrationNumber || '', make: job.vehicle.make || '', model: job.vehicle.model || '', year: job.vehicle.year || null } : null,
    serviceType: job.appointment?.serviceType || 'Service repair', completedAt: job.finalReport?.completedAt || job.updatedAt,
    parts: lines.parts, labourItems: lines.labourItems,
    approvedRepairs: (job.additionalRepairs || []).filter(repair => repair.status === 'Approved').map(repair => ({ description: repair.description || 'Approved additional repair', amount: roundMoney(repair.estimatedCost) })),
    partsCost: existing?.partsCost ?? lines.partsCost, labourCost: existing?.labourCost ?? lines.labourCost,
    additionalRepairsCost: existing?.additionalRepairsCost ?? lines.additionalRepairsCost, subtotal: roundMoney(existing?.partsCost ?? lines.partsCost) + roundMoney(existing?.labourCost ?? lines.labourCost) + roundMoney(existing?.additionalRepairsCost ?? lines.additionalRepairsCost),
    invoice: existing ? { id: String(existing._id), invoiceNumber: existing.invoiceNumber, paymentStatus: existing.paymentStatus, totalAmount: existing.totalAmount, tax: existing.tax || 0, discount: existing.discount || 0 } : null,
  };
}

export async function listBillableJobs(req, res) {
  try {
    const jobs = await ServiceJob.find({ status: 'Ready' }).populate(jobPopulate).sort({ updatedAt: -1 }).lean();
    res.set('Cache-Control', 'private, no-store').json({ jobs: jobs.map(serializeJob) });
  } catch {
    res.status(503).json({ message: 'Unable to load completed jobs for billing.' });
  }
}

export async function saveJobInvoice(req, res) {
  const taxRate = Number(req.body?.taxRate ?? 0);
  const discountRate = Number(req.body?.discountRate ?? 0);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 || !Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100) {
    return res.status(400).json({ message: 'Tax and discount rates must be between 0 and 100 percent.' });
  }
  try {
    const job = await ServiceJob.findOne({ _id: req.params.jobId, status: 'Ready' }).populate(jobPopulate);
    if (!job) return res.status(404).json({ message: 'Completed service job not found.' });
    let invoice = await Invoice.findOne({ serviceJob: job._id, paymentStatus: { $ne: 'Cancelled' } });
    if (invoice && invoice.paymentStatus !== 'Draft') return res.status(409).json({ message: 'This job already has a finalized invoice.' });
    const lines = buildInvoiceLines(job);
    const subtotal = roundMoney(lines.partsCost + lines.labourCost + lines.additionalRepairsCost);
    const discount = roundMoney(subtotal * discountRate / 100);
    const tax = roundMoney((subtotal - discount) * taxRate / 100);
    const totalAmount = roundMoney(subtotal - discount + tax);
    if (!invoice) {
      invoice = await Invoice.create({
        serviceJob: job._id, customer: job.customer?._id || job.customer,
        invoiceNumber: `INV-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`,
        ...lines, tax, discount, totalAmount, paymentStatus: 'Draft',
      });
      job.billingInvoice = invoice._id;
    } else {
      Object.assign(invoice, { ...lines, tax, discount, totalAmount });
    }
    if (req.body.finalize) invoice.paymentStatus = 'Pending';
    if (typeof invoice.save === 'function') await invoice.save();
    if (typeof job.save === 'function' && !job.billingInvoice?._id) await job.save();
    res.set('Cache-Control', 'private, no-store').json({
      message: req.body.finalize ? 'Invoice finalized and issued to the customer.' : 'Draft invoice saved for review.',
      invoice: { id: String(invoice._id), invoiceNumber: invoice.invoiceNumber, paymentStatus: invoice.paymentStatus, partsCost: invoice.partsCost, labourCost: invoice.labourCost, additionalRepairsCost: invoice.additionalRepairsCost, tax: invoice.tax, discount: invoice.discount, totalAmount: invoice.totalAmount },
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An invoice already exists for this job. Refresh the billing page and try again.' });
    res.status(503).json({ message: 'Unable to save this invoice. Please try again.' });
  }
}
