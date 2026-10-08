import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  mobile: { type: String, unique: true, sparse: true }, // Legacy profiles may omit mobile
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin', 'Customer', 'Admin', 'Technician', 'Finance'], default: 'Customer' },
  isActive: { type: Boolean, default: true },
  resetTokenHash: { type: String, select: false },
  resetTokenExpiresAt: { type: Date, select: false },
  sessionVersion: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
