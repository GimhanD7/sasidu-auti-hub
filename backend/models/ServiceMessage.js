import mongoose from 'mongoose';

const serviceMessageSchema = new mongoose.Schema({
  serviceJob: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceJob', required: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['Customer', 'Admin', 'Technician'], required: true },
  body: { type: String, required: true, trim: true, maxlength: 2000 },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

serviceMessageSchema.index({ serviceJob: 1, createdAt: 1 });

export default mongoose.model('ServiceMessage', serviceMessageSchema);
