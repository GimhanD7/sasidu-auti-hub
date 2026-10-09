import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ['Bank Transfer', 'Pay at Workshop', 'Cash', 'Card', 'Online'], required: true },
  transactionReference: { type: String, required: true, trim: true, maxlength: 100 },
  receiptNumber: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ['Pending Verification', 'Completed', 'Failed'], default: 'Pending Verification', index: true },
  failureReason: { type: String, trim: true, maxlength: 500 },
  paymentSlip: {
    data: { type: String },
    contentType: { type: String, trim: true, maxlength: 100 },
    fileName: { type: String, trim: true, maxlength: 255 },
    fileSize: { type: Number },
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
}, { timestamps: true });

paymentSchema.pre('validate', function setReceiptNumber() {
  if (!this.receiptNumber && this._id) this.receiptNumber = `RCPT-${String(this._id).slice(-10).toUpperCase()}`;
});

paymentSchema.index({ invoice: 1 }, { unique: true, partialFilterExpression: { status: 'Pending Verification' } });

export default mongoose.model('Payment', paymentSchema);
