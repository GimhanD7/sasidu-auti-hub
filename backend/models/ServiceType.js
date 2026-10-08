import mongoose from 'mongoose';

const serviceTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  defaultDurationMinutes: { type: Number, required: true, min: 15, max: 1440 },
  estimatedCost: { type: Number, required: true, min: 0, max: 10000000 },
  requiredSkill: { type: String, required: true, trim: true, maxlength: 100 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('ServiceType', serviceTypeSchema);
