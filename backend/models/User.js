import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  mobile: { type: String, unique: true, sparse: true }, // Legacy profiles may omit mobile
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'Customer', 'Admin', 'Technician', 'Finance'], default: 'Customer' },
  isActive: { type: Boolean, default: true },
  resetTokenHash: { type: String, select: false },
  resetTokenExpiresAt: { type: Date, select: false },
  sessionVersion: { type: Number, default: 0 },
  technicianSpecialization: { type: String, trim: true, maxlength: 120 },
  availabilityStatus: { type: String, enum: ['Available', 'Busy', 'Break', 'Off Duty', 'Leave'], default: 'Available' },
  workSchedule: {
    days: { type: [Number], default: [1, 2, 3, 4, 5, 6] },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '17:00' },
  },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
