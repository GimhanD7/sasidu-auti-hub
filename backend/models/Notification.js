import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true }, // e.g., 'AppointmentConfirmation', 'RepairUpdate'
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: { type: String }, // optional link to job or invoice
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
