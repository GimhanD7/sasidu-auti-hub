import mongoose from 'mongoose';

const serviceJobSchema = new mongoose.Schema({
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: {
    type: String,
    enum: ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test', 'Ready'],
    default: 'Inspecting'
  },
  priority: { type: String, enum: ['Low', 'Normal', 'High', 'Urgent'], default: 'Normal' },
  expectedCompletionTime: { type: Date },
  mileageAtService: { type: Number, min: 0 },
  recommendations: [{
    title: { type: String, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    dueAt: { type: Date },
    dueMileage: { type: Number, min: 0 }
  }],
  documents: [{
    title: { type: String, trim: true, maxlength: 120 },
    url: { type: String, trim: true, maxlength: 2048 },
    uploadedAt: { type: Date, default: Date.now }
  }],
  additionalRepairs: [{
    description: String,
    estimatedCost: Number,
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    photos: [String]
  }],
  timeline: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    notes: String
  }]
}, { timestamps: true });

export default mongoose.model('ServiceJob', serviceJobSchema);
