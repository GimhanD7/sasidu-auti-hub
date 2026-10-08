import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import ServiceJob from '../models/ServiceJob.js';
import { invoiceEmail } from '../services/invoiceEmail.js';

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

export async function listFinanceInvoices(req, res) {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 }).limit(500)
      .populate({ path: 'customer', select: 'name email mobile' })
      .populate({ path: 'serviceJob', select: 'serviceNumber vehicle appointment', populate: [
        { path: 'vehicle', select: 'registrationNumber make model year' },
        { path: 'appointment', select: 'serviceType' },
      ] }).lean();
    res.set('Cache-Control', 'private, no-store').json({ invoices: invoices.map(invoice => {
      const job = invoice.serviceJob || {};
      const vehicle = job.vehicle || null;
      return {
        id: String(invoice._id), invoiceNumber: invoice.invoiceNumber,
        paymentStatus: invoice.paymentStatus || 'Pending', totalAmount: roundMoney(invoice.totalAmount),
        amountPaid: roundMoney(invoice.amountPaid), amountDue: roundMoney(Math.max(0, invoice.totalAmount - (invoice.amountPaid || 0))),
        parts: invoice.parts || [], labourItems: invoice.labourItems || [],
        partsCost: roundMoney(invoice.partsCost), labourCost: roundMoney(invoice.labourCost), additionalRepairsCost: roundMoney(invoice.additionalRepairsCost), tax: roundMoney(invoice.tax), discount: roundMoney(invoice.discount),
        issuedAt: invoice.createdAt, paymentDate: invoice.paymentDate || null, paymentMethod: invoice.paymentMethod || '',
        customer: invoice.customer ? { name: invoice.customer.name || 'Customer', email: invoice.customer.email || '', mobile: invoice.customer.mobile || '' } : null,
        serviceJob: { id: job._id ? String(job._id) : '', serviceNumber: job.serviceNumber || '', serviceType: job.appointment?.serviceType || 'Service repair', vehicle: vehicle ? { make: vehicle.make || '', model: vehicle.model || '', year: vehicle.year || null, registrationNumber: vehicle.registrationNumber || '' } : null },
      };
    }) });
  } catch {
    res.status(503).json({ message: 'Unable to load invoices. Please try again.' });
  }
}

export async function updateDraftInvoice(req, res) {
  const { invoiceId } = req.params;
  const taxRate = Number(req.body?.taxRate ?? 0);
  const discountRate = Number(req.body?.discountRate ?? 0);
  if (!mongoose.isValidObjectId(invoiceId)) return res.status(400).json({ message: 'Invalid invoice.' });
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 || !Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100) return res.status(400).json({ message: 'Tax and discount rates must be between 0 and 100 percent.' });
  try {
    const invoice = await Invoice.findOne({ _id: invoiceId, paymentStatus: 'Draft' });
    if (!invoice) return res.status(404).json({ message: 'Draft invoice not found.' });
    const subtotal = roundMoney((invoice.partsCost || 0) + (invoice.labourCost || 0) + (invoice.additionalRepairsCost || 0));
    invoice.discount = roundMoney(subtotal * discountRate / 100);
    invoice.tax = roundMoney((subtotal - invoice.discount) * taxRate / 100);
    invoice.totalAmount = roundMoney(subtotal - invoice.discount + invoice.tax);
    if (req.body?.finalize === true) invoice.paymentStatus = 'Pending';
    await invoice.save();
    res.set('Cache-Control', 'private, no-store').json({ message: req.body?.finalize === true ? 'Invoice finalized and issued to the customer.' : 'Draft invoice updated.', invoice: {
      id: String(invoice._id), invoiceNumber: invoice.invoiceNumber, paymentStatus: invoice.paymentStatus,
      partsCost: invoice.partsCost, labourCost: invoice.labourCost, additionalRepairsCost: invoice.additionalRepairsCost,
      tax: invoice.tax, discount: invoice.discount, totalAmount: invoice.totalAmount,
    } });
  } catch {
    res.status(503).json({ message: 'Unable to update this invoice. Please try again.' });
  }
}

export async function deleteDraftInvoice(req, res) {
  const { invoiceId } = req.params;
  if (!mongoose.isValidObjectId(invoiceId)) return res.status(400).json({ message: 'Invalid invoice.' });
  try {
    const invoice = await Invoice.findOne({ _id: invoiceId, paymentStatus: 'Draft' });
    if (!invoice) return res.status(404).json({ message: 'Draft invoice not found.' });
    await ServiceJob.updateOne({ billingInvoice: invoice._id }, { $unset: { billingInvoice: 1 } });
    await invoice.deleteOne();
    res.set('Cache-Control', 'private, no-store').json({ message: 'Draft invoice deleted.' });
  } catch {
    res.status(503).json({ message: 'Unable to delete this draft invoice. Please try again.' });
  }
}

export async function sendFinanceInvoice(req, res) {
  const { invoiceId } = req.params;
  if (!mongoose.isValidObjectId(invoiceId)) return res.status(400).json({ message: 'Invalid invoice.' });
  if (!invoiceEmail.isConfigured()) return res.status(503).json({ message: 'Invoice email is unavailable until SMTP is configured.' });
  try {
    const invoice = await Invoice.findById(invoiceId).populate({ path: 'customer', select: 'name email' });
    if (!invoice || ['Draft', 'Cancelled'].includes(invoice.paymentStatus)) return res.status(404).json({ message: 'Issued invoice not found.' });
    if (!invoice.customer?.email) return res.status(409).json({ message: 'This customer does not have an email address.' });
    await invoiceEmail.send(invoice, invoice.customer);
    res.set('Cache-Control', 'private, no-store').json({ message: `Invoice ${invoice.invoiceNumber} sent to ${invoice.customer.email}.` });
  } catch {
    res.status(503).json({ message: 'Unable to send this invoice. Check the mail configuration and try again.' });
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
    const createdNew = !invoice;
    if (createdNew) {
      invoice = await Invoice.create({
        serviceJob: job._id, customer: job.customer?._id || job.customer,
        invoiceNumber: `INV-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`,
        ...lines, tax, discount, totalAmount, paymentStatus: 'Draft',
      });
      job.billingInvoice = invoice._id;
    } else {
      Object.assign(invoice, { ...lines, tax, discount, totalAmount });
    }
    if (req.body.finalize === true) invoice.paymentStatus = 'Pending';
    if (typeof invoice.save === 'function') await invoice.save();
    if (createdNew && typeof job.save === 'function') await job.save();
    res.set('Cache-Control', 'private, no-store').json({
      message: req.body.finalize === true ? 'Invoice finalized and issued to the customer.' : 'Draft invoice saved for review.',
      invoice: { id: String(invoice._id), invoiceNumber: invoice.invoiceNumber, paymentStatus: invoice.paymentStatus, partsCost: invoice.partsCost, labourCost: invoice.labourCost, additionalRepairsCost: invoice.additionalRepairsCost, tax: invoice.tax, discount: invoice.discount, totalAmount: invoice.totalAmount },
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An invoice already exists for this job. Refresh the billing page and try again.' });
    res.status(503).json({ message: 'Unable to save this invoice. Please try again.' });
  }
}
