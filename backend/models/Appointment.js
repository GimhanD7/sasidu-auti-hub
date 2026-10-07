import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  serviceType: { type: String, required: true },
  preferredDate: { type: Date, required: true },
  preferredTime: { type: String, required: true },
  problemDescription: { type: String },
  customerNotes: { type: String },
  status: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Checked In', 'In Service', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Appointment', appointmentSchema);
