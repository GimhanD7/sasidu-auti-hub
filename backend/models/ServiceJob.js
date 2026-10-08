import mongoose from 'mongoose';

const serviceJobSchema = new mongoose.Schema({
  serviceNumber: { type: String, unique: true, sparse: true, default: function serviceNumberFromId() { return `JOB-${String(this._id).slice(-8).toUpperCase()}`; } },
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
  tasks: [{
    title: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, enum: ['Pending', 'In Progress', 'Complete'], default: 'Pending' },
    notes: { type: String, trim: true, maxlength: 1000 },
    completedAt: Date,
  }],
  timeline: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    notes: String
  }]
}, { timestamps: true });

export default mongoose.model('ServiceJob', serviceJobSchema);
