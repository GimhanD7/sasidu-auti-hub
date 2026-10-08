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
  internalNotes: { type: String, trim: true, maxlength: 1000, select: false },
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
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  history: [{
    action: { type: String, required: true, maxlength: 200 },
    details: { type: String, maxlength: 1000 },
    timestamp: { type: Date, default: Date.now },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }]
}, { timestamps: true });

appointmentSchema.pre('save', function releaseFinishedSlot() {
  this.$locals.sendConfirmationNotification = !this.isNew && this.isModified('status') && this.status === 'Confirmed';
  this.$locals.sendCheckedInNotification = !this.isNew && this.isModified('status') && this.status === 'Checked In';
  if (this.isModified('preferredDate') || this.isModified('preferredTime')) {
    if (!this.isNew) this.reminderSentAt = undefined;
    if (this.preferredDate && this.preferredTime) this.bookingSlotKey = `${this.preferredDate.toISOString().slice(0, 10)}|${this.preferredTime}`;
  }
  if (this.status === 'Cancelled' || this.status === 'Completed') this.bookingSlotKey = undefined;
});

appointmentSchema.post('save', async function notifyCustomerOfConfirmation(appointment) {
  const number = appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`;
  const notifications = [];
  if (appointment.$locals.sendConfirmationNotification) notifications.push({
    type: 'AppointmentConfirmation', title: 'Appointment confirmed',
    message: `Appointment ${number} is confirmed for ${appointment.preferredDate.toISOString().slice(0, 10)} at ${appointment.preferredTime}.`,
    dedupeKey: `appointment-confirmed:${appointment._id}`,
  });
  if (appointment.$locals.sendCheckedInNotification) notifications.push({
    type: 'VehicleCheckedIn', title: 'Vehicle checked in',
    message: `${number}: your vehicle has been checked in at the workshop.`,
    dedupeKey: `appointment-checked-in:${appointment._id}`,
  });
  if (!notifications.length) return;
  try { await Notification.insertMany(notifications.map(item => ({ ...item, user: appointment.customer, link: '/customer/appointments' })), { ordered: false }); }
  catch { /* Appointment state remains authoritative if notification storage is unavailable. */ }
});

export default mongoose.model('Appointment', appointmentSchema);
