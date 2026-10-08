import mongoose from 'mongoose';

const jobPhotoSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceJob', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename: { type: String, required: true, trim: true, maxlength: 160 },
  contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
  category: { type: String, enum: ['Job', 'Inspection', 'RepairEvidence'], default: 'Job', index: true },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('JobPhoto', jobPhotoSchema);
