import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  serviceJob: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceJob', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoiceNumber: { type: String, required: true, unique: true },
  partsCost: { type: Number, default: 0 },
  labourCost: { type: Number, default: 0 },
  additionalRepairsCost: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['Draft', 'Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'],
    default: 'Pending'
  },
  paymentMethod: { type: String },
  paymentDate: { type: Date }
}, { timestamps: true });

export default mongoose.model('Invoice', invoiceSchema);
