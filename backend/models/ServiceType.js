// Service catalog fields describe booking duration, estimated cost, and required skill; active/deleted flags control catalog visibility.
import mongoose from 'mongoose';

const serviceTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  defaultDurationMinutes: { type: Number, required: true, min: 15, max: 1440 },
  estimatedCost: { type: Number, required: true, min: 0, max: 10000000 },
  requiredSkill: { type: String, required: true, trim: true, maxlength: 100 },
  isDeleted: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('ServiceType', serviceTypeSchema);
