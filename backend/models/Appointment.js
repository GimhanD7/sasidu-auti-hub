import mongoose from 'mongoose';
import Notification from './Notification.js';

const appointmentSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  appointmentNumber: { type: String, unique: true, sparse: true },
  bookingSlotKey: { type: String, unique: true, sparse: true },
  serviceType: { type: String, required: true },
  preferredDate: { type: Date, required: true },
  preferredTime: { type: String, required: true },
  problemDescription: { type: String, trim: true, maxlength: 1000 },
  customerNotes: { type: String, trim: true, maxlength: 1000 },
  rescheduleRequest: {
    preferredDate: Date,
    preferredTime: String,
    notes: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'] },
    requestedAt: Date,
    respondedAt: Date,
  },
  reminderSentAt: Date,
  status: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Checked In', 'In Service', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

appointmentSchema.pre('save', function releaseFinishedSlot() {
  this.$locals.sendConfirmationNotification = !this.isNew && this.isModified('status') && this.status === 'Confirmed';
  if (this.isModified('preferredDate') || this.isModified('preferredTime')) {
    if (!this.isNew) this.reminderSentAt = undefined;
    if (this.preferredDate && this.preferredTime) this.bookingSlotKey = `${this.preferredDate.toISOString().slice(0, 10)}|${this.preferredTime}`;
  }
  if (this.status === 'Cancelled' || this.status === 'Completed') this.bookingSlotKey = undefined;
});

appointmentSchema.post('save', async function notifyCustomerOfConfirmation(appointment) {
  if (!appointment.$locals.sendConfirmationNotification) return;
  const number = appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`;
  try {
    await Notification.create({
      user: appointment.customer,
      type: 'AppointmentConfirmation',
      title: 'Appointment confirmed',
      message: `Appointment ${number} is confirmed for ${appointment.preferredDate.toISOString().slice(0, 10)} at ${appointment.preferredTime}.`,
      link: '/customer/appointments',
      dedupeKey: `appointment-confirmed:${appointment._id}`,
    });
  } catch { /* Confirmation is saved; notification creation retries through other channels if available. */ }
});

export default mongoose.model('Appointment', appointmentSchema);
