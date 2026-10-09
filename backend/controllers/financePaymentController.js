import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const PAYMENT_METHODS = ['Cash', 'Card', 'Online', 'Bank Transfer', 'Pay at Workshop'];
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listFinancePayments(req, res) {
  try {
    const payments = await Payment.find().sort({ status: 1, createdAt: -1 }).limit(200)
      .populate({ path: 'customer', select: 'name email' })
      .populate({ path: 'invoice', select: 'invoiceNumber totalAmount paymentStatus' }).lean();
    res.set('Cache-Control', 'private, no-store').json(payments.map(payment => ({
      id: String(payment._id), amount: payment.amount, method: payment.method,
      transactionReference: payment.transactionReference, receiptNumber: payment.receiptNumber,
      paymentSlip: payment.paymentSlip || null,
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
  if (method && !PAYMENT_METHODS.includes(method)) return res.status(400).json({ message: 'Choose a supported payment method.' });
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
        paymentSlip: payment.paymentSlip || null,
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
