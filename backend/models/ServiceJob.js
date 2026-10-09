// Persist repair progress, assignments, parts, labour, reports, and history. Save hooks create customer notices for selected status milestones.
import mongoose from 'mongoose';
import Notification from './Notification.js';

const serviceJobSchema = new mongoose.Schema({
  serviceNumber: { type: String, unique: true, sparse: true, default: function serviceNumberFromId() { return `JOB-${String(this._id).slice(-8).toUpperCase()}`; } },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', unique: true, sparse: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  technicianAssignments: [{
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date, default: Date.now },
    action: { type: String, enum: ['Assigned', 'Reassigned', 'Removed'] },
  }],
  status: {
    type: String,
    enum: ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test', 'Ready'],
    default: 'In Progress'
  },
  customerComplaint: { type: String, trim: true, maxlength: 1000 },
  inspection: {
    findings: { type: String, trim: true, maxlength: 5000, default: '' },
    diagnosis: { type: String, trim: true, maxlength: 5000, default: '' },
    notes: { type: String, trim: true, maxlength: 5000, default: '' },
    issues: [{ type: String, trim: true, maxlength: 500 }],
    recommendedRepairs: [{ type: String, trim: true, maxlength: 500 }],
    startedAt: Date,
    completedAt: Date,
  },
  diagnosticReport: {
    result: { type: String, trim: true, maxlength: 5000, default: '' },
    issueCategory: { type: String, enum: ['Engine', 'Transmission', 'Brakes', 'Electrical', 'Suspension', 'Cooling', 'Exhaust', 'Tyres', 'Body', 'Other'], default: 'Other' },
    faultDescription: { type: String, trim: true, maxlength: 5000, default: '' },
    recommendedAction: { type: String, trim: true, maxlength: 5000, default: '' },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    estimatedRepairMinutes: { type: Number, min: 1, max: 10080 },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: Date,
  },
  repairNotes: [{
    note: { type: String, required: true, trim: true, maxlength: 2000 },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  }],
  labourEntries: [{
    description: { type: String, trim: true, maxlength: 200 },
    labourType: { type: String, enum: ['Inspection', 'Diagnostics', 'Repair', 'Testing', 'Other'], default: 'Repair' },
    minutes: { type: Number, min: 1, max: 1440, required: true },
    ratePerHour: { type: Number, min: 0, default: 0 },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startedAt: Date,
    endedAt: Date,
    recordedAt: { type: Date, default: Date.now },
  }],
  activeLabourTimer: {
    description: { type: String, trim: true, maxlength: 200 },
    labourType: { type: String, enum: ['Inspection', 'Diagnostics', 'Repair', 'Testing', 'Other'] },
    ratePerHour: { type: Number, min: 0 },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startedAt: Date,
  },
  finalTest: {
    startedAt: Date,
    completedAt: Date,
    result: { type: String, enum: ['Passed', 'Failed'] },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    unresolvedIssue: { type: String, trim: true, maxlength: 2000, default: '' },
    checklist: [{
      item: { type: String, required: true, trim: true, maxlength: 120 },
      result: { type: String, enum: ['Passed', 'Failed'], required: true },
      notes: { type: String, trim: true, maxlength: 500, default: '' },
    }],
  },
  finalReport: {
    notes: { type: String, trim: true, maxlength: 3000, default: '' },
    tasksVerified: { type: Boolean, default: false },
    partsVerified: { type: Boolean, default: false },
    labourVerified: { type: Boolean, default: false },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completedAt: Date,
  },
  billingInvoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
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

  tasks: [{
    title: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, enum: ['Pending', 'In Progress', 'Complete', 'Cancelled'], default: 'Pending' },
    notes: { type: String, trim: true, maxlength: 1000 },
    completedAt: Date,
  }],
  replacedParts: [{
    name: { type: String, trim: true, maxlength: 200 },
    partNumber: { type: String, trim: true, maxlength: 100 },
    quantity: { type: Number, min: 0 },
    unitCost: { type: Number, min: 0 },
    replacedAt: Date,
  }],
  timeline: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    notes: String,
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }]
}, { timestamps: true });

// Remember which customer milestone the status change represents before the document is saved.
serviceJobSchema.pre('save', function captureCustomerMilestones() {
  const milestones = {
    'Final Test': { type: 'FinalTest', title: 'Final testing started', message: 'Your vehicle has moved to final testing.' },
    Ready: { type: 'VehicleReady', title: 'Service completed', message: 'Your vehicle service is completed. The workshop will issue your invoice.' },
  };
  this.$locals.customerMilestones = [];
  if (!this.$locals.suppressCustomerStatusNotifications && this.isModified('status')) {
    const statusUpdate = [...(this.timeline || [])].reverse().find(event => event.status === this.status)?.notes?.trim();
    if (this.status === 'In Progress' && this.$locals.statusTransitionFrom === 'Final Test') this.$locals.customerMilestones.push(
      { type: 'FinalTestFailed', title: 'Additional work needed after final test', message: statusUpdate || 'The workshop found an issue during final testing and is returning your vehicle to repair.' },
    );
    else if (this.status === 'In Progress') this.$locals.customerMilestones.push(
      { type: 'RepairStarted', title: 'Repair started', message: `Work on your vehicle has started.${statusUpdate ? ` ${statusUpdate}` : ''}` },
    );
    else if (milestones[this.status]) this.$locals.customerMilestones.push({ ...milestones[this.status], message: `${milestones[this.status].message}${statusUpdate ? ` ${statusUpdate}` : ''}` });
  }

});

// Notifications are best effort after the job is stored; a notification failure must not undo repair progress.
serviceJobSchema.post('save', async function notifyCustomerOfServiceMilestones(job) {
  const notifications = (job.$locals.customerMilestones || []).map(item => ({
    user: job.customer, ...item, link: item.type === 'InvoiceNotification' ? '/customer/invoices' : '/customer/repair-tracking',
    dedupeKey: `service-job:${job._id}:${item.type}:${job.updatedAt?.getTime() || Date.now()}`,
  }));

  if (!notifications.length) return;
  try { await Notification.insertMany(notifications, { ordered: false }); }
  catch { /* Repair state remains authoritative if notification storage is unavailable. */ }
});

export default mongoose.model('ServiceJob', serviceJobSchema);
