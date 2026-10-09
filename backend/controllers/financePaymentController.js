import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import Invoice from '../models/Invoice.js';
import Notification from '../models/Notification.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { invoiceEmail } from '../services/invoiceEmail.js';

const FINANCE_PAYMENT_METHODS = ['Cash', 'Card', 'Online', 'Bank Transfer', 'Pay at Workshop'];

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listFinancePayments(req, res) {
  try {
    const payments = await Payment.find().sort({ status: 1, createdAt: -1 }).limit(200)
      .populate({ path: 'customer', select: 'name email' })
      .populate({ path: 'invoice', select: 'invoiceNumber totalAmount paymentStatus' }).lean();
    res.set('Cache-Control', 'private, no-store').json(payments.map(payment => ({
      id: String(payment._id), amount: payment.amount, method: payment.method,
      transactionReference: payment.transactionReference, receiptNumber: payment.receiptNumber,
      status: payment.status, failureReason: payment.failureReason || '', createdAt: payment.createdAt, reviewedAt: payment.reviewedAt || null,
      customer: payment.customer ? { name: payment.customer.name, email: payment.customer.email } : null,
      invoice: payment.invoice ? { id: String(payment.invoice._id), invoiceNumber: payment.invoice.invoiceNumber, totalAmount: payment.invoice.totalAmount, paymentStatus: payment.invoice.paymentStatus } : null,
    })));
  } catch {
    res.status(503).json({ message: 'Unable to load payment records. Please try again.' });
  }
}

export async function listFinancePaymentHistory(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const { search = '', method = '', from = '', to = '' } = req.query;
  if (typeof search !== 'string' || search.length > 100) return res.status(400).json({ message: 'Search must be 100 characters or fewer.' });
  if (method && !FINANCE_PAYMENT_METHODS.includes(method)) return res.status(400).json({ message: 'Choose a supported payment method.' });
  const dateFilter = {};
  if (from) {
    const start = new Date(`${from}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) return res.status(400).json({ message: 'Enter a valid start date.' });
    dateFilter.$gte = start;
  }
  if (to) {
    const end = new Date(`${to}T00:00:00.000Z`);
    if (Number.isNaN(end.getTime())) return res.status(400).json({ message: 'Enter a valid end date.' });
    end.setUTCDate(end.getUTCDate() + 1);
    dateFilter.$lt = end;
  }
  if (from && to && from > to) return res.status(400).json({ message: 'The start date must be before the end date.' });
  try {
    const filter = {};
    if (method) filter.method = method;
    if (Object.keys(dateFilter).length) filter.createdAt = dateFilter;
    if (search.trim()) {
      const expression = new RegExp(escapeRegex(search.trim()), 'i');
      const [customers, invoices] = await Promise.all([
        User.find({ $or: [{ name: expression }, { email: expression }] }).select('_id').limit(100).lean(),
        Invoice.find({ invoiceNumber: expression }).select('_id').limit(100).lean(),
      ]);
      filter.$or = [
        { transactionReference: expression }, { receiptNumber: expression },
        { customer: { $in: customers.map(customer => customer._id) } },
        { invoice: { $in: invoices.map(invoice => invoice._id) } },
      ];
    }
    const [total, payments] = await Promise.all([
      Payment.countDocuments(filter),
      Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate({ path: 'customer', select: 'name email' })
        .populate({ path: 'invoice', select: 'invoiceNumber totalAmount amountPaid paymentStatus' }).lean(),
    ]);
    res.set('Cache-Control', 'private, no-store').json({
      payments: payments.map(payment => ({
        id: String(payment._id), amount: payment.amount, method: payment.method,
        transactionReference: payment.transactionReference, receiptNumber: payment.receiptNumber,
        status: payment.status, failureReason: payment.failureReason || '', createdAt: payment.createdAt,
        reviewedAt: payment.reviewedAt || null,
        customer: payment.customer ? { name: payment.customer.name, email: payment.customer.email } : null,
        invoice: payment.invoice ? { id: String(payment.invoice._id), invoiceNumber: payment.invoice.invoiceNumber, totalAmount: payment.invoice.totalAmount, amountPaid: payment.invoice.amountPaid || 0, paymentStatus: payment.invoice.paymentStatus } : null,
      })),
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  } catch {
    res.status(503).json({ message: 'Unable to load payment history. Please try again.' });
  }
}

export async function listPayableInvoices(req, res) {
  try {
    const invoices = await Invoice.find({ paymentStatus: { $in: ['Pending', 'Partially Paid', 'Overdue'] } })
      .sort({ createdAt: -1 })
      .populate({ path: 'customer', select: 'name email' })
      .populate({ path: 'serviceJob', select: 'serviceNumber vehicle', populate: { path: 'vehicle', select: 'registrationNumber make model' } }).lean();
    res.set('Cache-Control', 'private, no-store').json({ invoices: invoices.map(invoice => ({
      id: String(invoice._id), invoiceNumber: invoice.invoiceNumber, paymentStatus: invoice.paymentStatus,
      totalAmount: Number(invoice.totalAmount) || 0, amountPaid: Number(invoice.amountPaid) || 0,
      amountDue: Math.max(0, Math.round((Number(invoice.totalAmount || 0) - Number(invoice.amountPaid || 0)) * 100) / 100),
      customer: invoice.customer ? { name: invoice.customer.name, email: invoice.customer.email } : null,
      serviceNumber: invoice.serviceJob?.serviceNumber || '',
      vehicle: invoice.serviceJob?.vehicle ? `${invoice.serviceJob.vehicle.registrationNumber || ''} ${invoice.serviceJob.vehicle.make || ''} ${invoice.serviceJob.vehicle.model || ''}`.trim() : '',
    })).filter(invoice => invoice.amountDue > 0) });
  } catch {
    res.status(503).json({ message: 'Unable to load invoices with outstanding balances.' });
  }
}

export async function listOutstandingInvoices(req, res) {
  try {
    const invoices = await Invoice.find({ paymentStatus: { $in: ['Pending', 'Partially Paid', 'Overdue'] } })
      .sort({ dueDate: 1, createdAt: 1 })
      .populate({ path: 'customer', select: 'name email mobile' })
      .populate({ path: 'serviceJob', select: 'serviceNumber vehicle', populate: { path: 'vehicle', select: 'registrationNumber make model' } }).lean();
    const now = new Date();
    const rows = await Promise.all(invoices.map(async invoice => {
      const amountDue = Math.max(0, Math.round((Number(invoice.totalAmount || 0) - Number(invoice.amountPaid || 0)) * 100) / 100);
      if (!amountDue) return null;
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : new Date(new Date(invoice.createdAt || now).getTime() + 30 * 24 * 60 * 60 * 1000);
      const isOverdue = dueDate < now;
      const overdueDays = isOverdue ? Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000))) : 0;
      const paymentStatus = isOverdue ? 'Overdue' : invoice.paymentStatus === 'Overdue' ? 'Pending' : invoice.paymentStatus;
      if (paymentStatus !== invoice.paymentStatus) {
        try { await Invoice.updateOne({ _id: invoice._id, paymentStatus: invoice.paymentStatus }, { $set: { paymentStatus } }); }
        catch { /* The response still shows the derived overdue state; persistence retries on the next visit. */ }
      }
      return {
        id: String(invoice._id), invoiceNumber: invoice.invoiceNumber,
        paymentStatus, totalAmount: Number(invoice.totalAmount) || 0,
        amountPaid: Number(invoice.amountPaid) || 0, amountDue,
        issuedAt: invoice.createdAt, dueDate,
        overdueDays,
        customer: invoice.customer ? { name: invoice.customer.name || 'Customer', email: invoice.customer.email || '', mobile: invoice.customer.mobile || '' } : null,
        serviceNumber: invoice.serviceJob?.serviceNumber || '',
        vehicle: invoice.serviceJob?.vehicle ? `${invoice.serviceJob.vehicle.registrationNumber || ''} ${invoice.serviceJob.vehicle.make || ''} ${invoice.serviceJob.vehicle.model || ''}`.trim() : '',
      };
    }));
    const outstanding = rows.filter(Boolean).sort((left, right) => new Date(left.dueDate) - new Date(right.dueDate));
    res.set('Cache-Control', 'private, no-store').json({
      summary: {
        totalOutstanding: Math.round(outstanding.reduce((sum, invoice) => sum + invoice.amountDue, 0) * 100) / 100,
        unpaidInvoices: outstanding.filter(invoice => invoice.paymentStatus !== 'Overdue').length,
        overdueInvoices: outstanding.filter(invoice => invoice.paymentStatus === 'Overdue').length,
      },
      invoices: outstanding,
    });
  } catch {
    res.status(503).json({ message: 'Unable to load outstanding invoices.' });
  }
}

export async function sendPaymentReminder(req, res) {
  const { invoiceId } = req.params;
  if (!mongoose.isValidObjectId(invoiceId)) return res.status(400).json({ message: 'Invalid invoice.' });
  if (!invoiceEmail.isConfigured()) return res.status(503).json({ message: 'Payment reminders are unavailable until SMTP is configured.' });
  try {
    const invoice = await Invoice.findOne({ _id: invoiceId, paymentStatus: { $in: ['Pending', 'Partially Paid', 'Overdue'] } }).populate({ path: 'customer', select: 'name email' });
    if (!invoice) return res.status(404).json({ message: 'Outstanding invoice not found.' });
    if (!invoice.customer?.email) return res.status(409).json({ message: 'This customer does not have an email address.' });
    const amountDue = Math.max(0, Math.round((Number(invoice.totalAmount) - Number(invoice.amountPaid || 0)) * 100) / 100);
    if (!amountDue) return res.status(409).json({ message: 'This invoice has no outstanding balance.' });
    await invoiceEmail.sendReminder(invoice, invoice.customer, amountDue);
    try {
      await Notification.create({ user: invoice.customer._id || invoice.customer, type: 'PaymentReminder', title: 'Payment reminder', message: `Invoice ${invoice.invoiceNumber} has an outstanding balance of LKR ${amountDue.toFixed(2)}.`, link: '/customer/payments', dedupeKey: `invoice-reminder:${invoice._id}:${Date.now()}` });
    } catch { /* Email delivery succeeded; notification storage is best effort. */ }
    res.set('Cache-Control', 'private, no-store').json({ message: `Payment reminder sent to ${invoice.customer.email}.` });
  } catch {
    res.status(503).json({ message: 'Unable to send this payment reminder. Please try again.' });
  }
}

export async function recordFinancePayment(req, res) {
  const { invoiceId, method } = req.body || {};
  const amount = Math.round((Number(req.body?.amount) + Number.EPSILON) * 100) / 100;
  let transactionReference = typeof req.body?.transactionReference === 'string' ? req.body.transactionReference.trim() : '';
  if (!mongoose.isValidObjectId(invoiceId)) return res.status(400).json({ message: 'Select a valid invoice.' });
  if (!FINANCE_PAYMENT_METHODS.includes(method)) return res.status(400).json({ message: 'Choose a supported payment method.' });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Enter a payment amount greater than zero.' });
  if (transactionReference.length > 100 || (['Card', 'Online', 'Bank Transfer'].includes(method) && transactionReference.length < 3)) return res.status(400).json({ message: 'Enter a transaction reference (3 to 100 characters) for this payment method.' });
  if (!transactionReference) transactionReference = `${method.toUpperCase().replaceAll(' ', '-')}-${randomBytes(5).toString('hex').toUpperCase()}`;
  try {
    const invoice = await Invoice.findOne({ _id: invoiceId, paymentStatus: { $in: ['Pending', 'Partially Paid', 'Overdue'] } });
    if (!invoice) return res.status(404).json({ message: 'Open invoice not found.' });
    const amountPaid = Math.round((Number(invoice.amountPaid || 0) + Number.EPSILON) * 100) / 100;
    const amountDue = Math.max(0, Math.round((Number(invoice.totalAmount) - amountPaid) * 100) / 100);
    if (amount > amountDue) return res.status(400).json({ message: `Payment cannot exceed the outstanding balance of LKR ${amountDue.toFixed(2)}.` });
    const reviewedAt = new Date();
    const payment = await Payment.create({
      invoice: invoice._id, customer: invoice.customer, amount, method, transactionReference,
      status: 'Completed', reviewedBy: req.user._id, reviewedAt,
    });
    const nextAmountPaid = Math.round((amountPaid + amount + Number.EPSILON) * 100) / 100;
    const nextStatus = nextAmountPaid >= Number(invoice.totalAmount) ? 'Paid' : 'Partially Paid';
    const updatedInvoice = await Invoice.findOneAndUpdate({
      _id: invoice._id, paymentStatus: { $in: ['Pending', 'Partially Paid', 'Overdue'] },
      $or: [{ amountPaid }, { amountPaid: { $exists: false } }],
    }, { $set: { amountPaid: nextAmountPaid, paymentStatus: nextStatus, paymentDate: reviewedAt, paymentMethod: method } }, { new: true, runValidators: true });
    if (!updatedInvoice) {
      await Payment.deleteOne({ _id: payment._id, status: 'Completed' });
      return res.status(409).json({ message: 'The invoice balance changed while recording this payment. Refresh and try again.' });
    }
    try {
      await Notification.create({ user: invoice.customer, type: 'PaymentConfirmation', title: 'Payment received', message: `Payment ${payment.receiptNumber} of LKR ${amount.toFixed(2)} for invoice ${invoice.invoiceNumber} was recorded.`, link: '/customer/invoices', dedupeKey: `payment:${payment._id}:finance-recorded` });
    } catch { /* Payment and invoice remain authoritative if notification delivery fails. */ }
    try {
      const admins = await User.find({ role: { $in: ['Admin', 'admin'] }, isActive: { $ne: false }, _id: { $ne: req.user._id } }).select('_id').lean();
      if (admins.length) await Notification.insertMany(admins.map(admin => ({ user: admin._id, type: 'PaymentConfirmation', title: 'Payment recorded', message: `${payment.receiptNumber} for invoice ${invoice.invoiceNumber} was recorded by Admin (${method}, LKR ${amount.toFixed(2)}).`, link: '/admin/payments', dedupeKey: `payment:${payment._id}:finance-recorded:admin:${admin._id}` })), { ordered: false });
    } catch { /* Finance retains the completed payment even if an admin notification cannot be delivered. */ }
    let receiptEmailSent = false;
    if (invoiceEmail.isConfigured()) {
      try {
        const customer = await User.findById(invoice.customer).select('name email');
        if (customer?.email) { await invoiceEmail.sendReceipt(payment, invoice, customer); receiptEmailSent = true; }
      } catch { /* Receipt remains available to Finance if SMTP delivery fails. */ }
    }
    res.status(201).set('Cache-Control', 'private, no-store').json({
      message: nextStatus === 'Paid' ? 'Payment recorded. The invoice is fully paid.' : 'Payment recorded. The invoice balance was updated.', receiptEmailSent,
      payment: { id: String(payment._id), receiptNumber: payment.receiptNumber, invoiceId: String(invoice._id), invoiceNumber: invoice.invoiceNumber, amount, method, transactionReference, status: 'Completed', createdAt: payment.createdAt || reviewedAt, reviewedAt },
      invoice: { paymentStatus: nextStatus, amountPaid: nextAmountPaid, amountDue: Math.max(0, Number(invoice.totalAmount) - nextAmountPaid), totalAmount: Number(invoice.totalAmount) },
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'This transaction reference is already recorded.' });
    res.status(503).json({ message: 'Unable to record this payment. Please try again.' });
  }
}

export async function reviewFinancePayment(req, res) {
  const { paymentId } = req.params;
  const { decision, failureReason = '' } = req.body || {};
  if (!mongoose.isValidObjectId(paymentId)) return res.status(400).json({ message: 'Invalid payment record.' });
  if (!['Completed', 'Failed'].includes(decision)) return res.status(400).json({ message: 'Choose Completed or Failed.' });
  if (typeof failureReason !== 'string' || failureReason.trim().length > 500) return res.status(400).json({ message: 'Failure details must be 500 characters or fewer.' });
  try {
    const pendingPayment = await Payment.findOne({ _id: paymentId, status: 'Pending Verification' });
    if (!pendingPayment) return res.status(404).json({ message: 'Pending payment submission not found.' });
    const invoice = await Invoice.findOne({ _id: pendingPayment.invoice, customer: pendingPayment.customer, paymentStatus: { $ne: 'Cancelled' } });
    if (!invoice) return res.status(409).json({ message: 'The invoice is no longer available for payment verification.' });

    const reviewedAt = new Date();
    const payment = await Payment.findOneAndUpdate({ _id: paymentId, status: 'Pending Verification' }, {
      $set: {
        status: decision,
        failureReason: decision === 'Failed' ? failureReason.trim() || 'Payment could not be verified.' : '',
        reviewedBy: req.user._id,
        reviewedAt,
      },
    }, { new: true, runValidators: true });
    if (!payment) return res.status(409).json({ message: 'This payment was already reviewed by another finance user.' });

    let invoiceStatus = invoice.paymentStatus;
    if (decision === 'Completed') {
      const rows = await Payment.aggregate([
        { $match: { invoice: invoice._id, customer: payment.customer, status: 'Completed' } },
        { $group: { _id: null, amount: { $sum: '$amount' } } },
      ]);
      const paymentTotal = Math.round((rows[0]?.amount || 0) * 100) / 100;
      const previousPaymentTotal = Math.max(0, paymentTotal - pendingPayment.amount);
      const legacyPaidBaseline = Math.max(0, Number(invoice.amountPaid || 0) - previousPaymentTotal);
      const amountPaid = Math.min(invoice.totalAmount, Math.round((legacyPaidBaseline + paymentTotal) * 100) / 100);
      invoiceStatus = amountPaid >= invoice.totalAmount ? 'Paid' : 'Partially Paid';
      await Invoice.updateOne({ _id: invoice._id, customer: payment.customer, paymentStatus: { $ne: 'Cancelled' } }, {
        $set: { amountPaid, paymentStatus: invoiceStatus, paymentDate: payment.reviewedAt, paymentMethod: payment.method },
      });
    }

    try {
      const admins = await User.find({ role: { $in: ['Admin', 'admin'] }, isActive: { $ne: false }, _id: { $ne: req.user._id } }).select('_id').lean();
      const notifications = [{
        user: payment.customer,
        type: decision === 'Completed' ? 'PaymentConfirmation' : 'PaymentFailed',
        title: decision === 'Completed' ? 'Payment confirmed' : 'Payment could not be confirmed',
        message: decision === 'Completed' ? `Payment ${payment.receiptNumber} for invoice ${invoice.invoiceNumber} was confirmed.` : `Payment ${payment.receiptNumber} for invoice ${invoice.invoiceNumber} failed verification: ${payment.failureReason}`,
        dedupeKey: `payment:${payment._id}:${decision}:customer`,
        link: `/customer/payments?invoice=${invoice._id}`,
      }, ...admins.map(admin => ({ user: admin._id, type: 'PaymentReviewComplete', title: `Payment ${decision.toLowerCase()}`, message: `${payment.receiptNumber} for ${invoice.invoiceNumber} was marked ${decision.toLowerCase()}.`, dedupeKey: `payment:${payment._id}:${decision}:admin:${admin._id}`, link: '/admin/payments' }))];
      await Notification.insertMany(notifications, { ordered: false });
    } catch { /* Payment review remains saved if notification storage is unavailable. */ }

    res.set('Cache-Control', 'private, no-store').json({ id: String(payment._id), status: payment.status, invoiceStatus, reviewedAt: payment.reviewedAt });
  } catch {
    res.status(503).json({ message: 'Unable to review this payment. Please try again.' });
  }
}
