import mongoose from 'mongoose';
import Notification from './Notification.js';
import ServiceJob from './ServiceJob.js';

const invoiceSchema = new mongoose.Schema({
  serviceJob: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceJob', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoiceNumber: { type: String, required: true, unique: true },
  parts: [{
    name: { type: String, trim: true, maxlength: 200 },
    partNumber: { type: String, trim: true, maxlength: 100 },
    quantity: { type: Number, min: 0 },
    unitPrice: { type: Number, min: 0 },
    total: { type: Number, min: 0 },
  }],
  labourItems: [{
    description: { type: String, trim: true, maxlength: 200 },
    hours: { type: Number, min: 0 },
    rate: { type: Number, min: 0 },
    total: { type: Number, min: 0 },
  }],
  partsCost: { type: Number, default: 0 },
  labourCost: { type: Number, default: 0 },
  additionalRepairsCost: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  amountPaid: { type: Number, min: 0, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['Draft', 'Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'],
    default: 'Pending'
  },
  paymentMethod: { type: String },
  paymentDate: { type: Date },
  dueDate: { type: Date }
}, { timestamps: true });

invoiceSchema.pre('save', function captureCustomerInvoiceEvents() {
  this.$locals.customerInvoiceEvent = null;
  if (this.paymentStatus === 'Pending' && !this.dueDate) this.dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (this.paymentStatus === 'Paid' && (this.isNew || this.isModified('paymentStatus'))) this.$locals.customerInvoiceEvent = 'PaymentConfirmation';
  else if ((this.isNew && this.paymentStatus !== 'Draft') || (!this.isNew && this.isModified('paymentStatus') && this.paymentStatus !== 'Draft' && this.paymentStatus !== 'Cancelled')) this.$locals.customerInvoiceEvent = 'InvoiceNotification';
});

invoiceSchema.post('save', async function notifyCustomerOfInvoiceEvent(invoice) {
  const type = invoice.$locals.customerInvoiceEvent;
  if (!type) return;
  try {
    const job = await ServiceJob.findById(invoice.serviceJob).select('serviceNumber').lean();
    const paid = type === 'PaymentConfirmation';
    await Notification.create({
      user: invoice.customer,
      type,
      title: paid ? 'Payment received' : 'New invoice available',
      message: paid ? `Payment for invoice ${invoice.invoiceNumber} was recorded.` : `Invoice ${invoice.invoiceNumber} for ${job?.serviceNumber || 'your service job'} is ready to review.`,
      link: '/customer/invoices',
      dedupeKey: `invoice:${invoice._id}:${type}`,
    });
  } catch { /* Invoice state remains authoritative if notification storage is unavailable. */ }
});

export default mongoose.model('Invoice', invoiceSchema);
