import mongoose from 'mongoose';

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
  status: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Checked In', 'In Service', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

appointmentSchema.pre('save', function releaseFinishedSlot() {
  if (this.status === 'Cancelled' || this.status === 'Completed') this.bookingSlotKey = undefined;
});

export default mongoose.model('Appointment', appointmentSchema);
