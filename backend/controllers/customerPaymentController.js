import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Notification from '../models/Notification.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';

const OPEN_INVOICE_STATUSES = ['Pending', 'Partially Paid', 'Overdue'];
const PAYMENT_METHODS = ['Bank Transfer', 'Pay at Workshop'];
const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export async function getCustomerPaymentOptions(req, res) {
  try {
    const [invoices, payments] = await Promise.all([
      Invoice.find({ customer: req.user._id, paymentStatus: { $in: OPEN_INVOICE_STATUSES } })
        .sort({ createdAt: -1 })
        .populate({ path: 'serviceJob', select: 'serviceNumber vehicle appointment', populate: [
          { path: 'vehicle', select: 'make model year registrationNumber' },
          { path: 'appointment', select: 'serviceType' },
        ] }).lean(),
      Payment.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(50).select('invoice amount method transactionReference receiptNumber status failureReason createdAt reviewedAt').populate({ path: 'invoice', select: 'invoiceNumber' }).lean(),
    ]);
    const invoiceIds = invoices.map(invoice => invoice._id);
    const [completedRows, pendingRows] = invoiceIds.length ? await Promise.all([
      Payment.aggregate([{ $match: { invoice: { $in: invoiceIds }, customer: req.user._id, status: 'Completed' } }, { $group: { _id: '$invoice', amount: { $sum: '$amount' } } }]),
      Payment.find({ invoice: { $in: invoiceIds }, customer: req.user._id, status: 'Pending Verification' }).select('invoice').lean(),
    ]) : [[], []];
    const paidByInvoice = new Map(completedRows.map(row => [String(row._id), row.amount]));
    const pendingIds = new Set(pendingRows.map(payment => String(payment.invoice)));
    res.set('Cache-Control', 'private, no-store').json({
      invoices: invoices.map(invoice => {
        const job = invoice.serviceJob;
        const amountPaid = money(Math.max(Number(invoice.amountPaid) || 0, paidByInvoice.get(String(invoice._id)) || 0));
        return {
          id: String(invoice._id), invoiceNumber: invoice.invoiceNumber,
          serviceNumber: job?.serviceNumber || (job?._id ? `JOB-${String(job._id).slice(-8).toUpperCase()}` : 'Service job unavailable'),
          serviceType: job?.appointment?.serviceType || 'Service repair',
          vehicle: job?.vehicle ? `${job.vehicle.year ? `${job.vehicle.year} ` : ''}${job.vehicle.make} ${job.vehicle.model}${job.vehicle.registrationNumber ? ` · ${job.vehicle.registrationNumber}` : ''}` : 'Vehicle details unavailable',
          totalAmount: invoice.totalAmount, amountPaid,
          amountDue: Math.max(0, money(invoice.totalAmount - amountPaid)),
          paymentStatus: amountPaid >= invoice.totalAmount ? 'Paid' : amountPaid > 0 ? 'Partially Paid' : invoice.paymentStatus,
          pendingVerification: pendingIds.has(String(invoice._id)),
        };
      }).filter(invoice => invoice.amountDue > 0),
      payments: payments.map(payment => ({
        id: String(payment._id), invoiceId: String(payment.invoice?._id || payment.invoice), invoiceNumber: payment.invoice?.invoiceNumber || '', amount: payment.amount, method: payment.method,
        transactionReference: payment.transactionReference, receiptNumber: payment.receiptNumber,
        status: payment.status, failureReason: payment.failureReason || '', createdAt: payment.createdAt, reviewedAt: payment.reviewedAt || null,
      })),
    });
  } catch {
    res.status(503).json({ message: 'Unable to load payment options. Please try again.' });
  }
}

export async function submitCustomerPayment(req, res) {
  const { invoiceId, method, transactionReference = '' } = req.body || {};
  if (!mongoose.isValidObjectId(invoiceId)) return res.status(400).json({ message: 'Choose a valid invoice.' });
  if (!PAYMENT_METHODS.includes(method)) return res.status(400).json({ message: 'Choose a supported payment method.' });
  if (typeof transactionReference !== 'string' || transactionReference.trim().length > 100 || (method === 'Bank Transfer' && transactionReference.trim().length < 3)) {
    return res.status(400).json({ message: 'Enter a valid bank transaction reference (3 to 100 characters).' });
  }
  try {
    const invoice = await Invoice.findOne({ _id: invoiceId, customer: req.user._id, paymentStatus: { $in: OPEN_INVOICE_STATUSES } });
    if (!invoice) return res.status(404).json({ message: 'Open invoice not found.' });
    if (await Payment.exists({ invoice: invoice._id, status: 'Pending Verification' })) return res.status(409).json({ message: 'A payment submission for this invoice is already awaiting verification.' });
    const totals = await Payment.aggregate([
      { $match: { invoice: invoice._id, customer: req.user._id, status: 'Completed' } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]);
    const paidSoFar = Math.max(Number(invoice.amountPaid) || 0, totals[0]?.amount || 0);
    const amountDue = Math.max(0, money(invoice.totalAmount - paidSoFar));
    if (amountDue <= 0) return res.status(409).json({ message: 'This invoice is already paid.' });
    const generatedReference = method === 'Pay at Workshop' ? `WORKSHOP-${new mongoose.Types.ObjectId().toString().slice(-8).toUpperCase()}` : transactionReference.trim();
    const payment = await Payment.create({ invoice: invoice._id, customer: req.user._id, amount: amountDue, method, transactionReference: generatedReference });
    try {
      const admins = await User.find({ role: { $in: ['Admin', 'admin', 'Finance'] }, isActive: { $ne: false } }).select('_id').lean();
      if (admins.length) await Notification.insertMany(admins.map(admin => ({ user: admin._id, type: 'PaymentVerificationRequired', title: 'Payment needs verification', message: `${invoice.invoiceNumber}: ${method} payment of LKR ${amountDue.toFixed(2)} was submitted.`, dedupeKey: `payment:${payment._id}:verification:${admin._id}`, link: '/finance/payments' })), { ordered: false });
    } catch { /* Payment record remains available in the finance queue if notifications fail. */ }
    res.status(201).set('Cache-Control', 'private, no-store').json({
      id: String(payment._id), invoiceId: String(invoice._id), invoiceNumber: invoice.invoiceNumber,
      amount: payment.amount, method: payment.method, transactionReference: payment.transactionReference,
      receiptNumber: payment.receiptNumber, status: payment.status, createdAt: payment.createdAt,
      message: method === 'Bank Transfer' ? 'Your transfer reference was submitted for verification. The invoice will update after the workshop confirms receipt.' : 'Your pay-at-workshop request was recorded. Pay the amount at the workshop; the invoice will update after staff confirms payment.',
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A payment reference or pending submission already exists. Check your payment history before retrying.' });
    res.status(503).json({ message: 'Unable to submit this payment. Please try again.' });
  }
}
