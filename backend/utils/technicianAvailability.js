import Appointment from '../models/Appointment.js';
import ServiceJob from '../models/ServiceJob.js';

export const ACTIVE_JOB_STATUSES = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test'];

export async function technicianAssignmentConflict(technicianId, { appointmentId, jobId, preferredDate, preferredTime } = {}) {
  const jobFilter = { technician: technicianId, status: { $in: ACTIVE_JOB_STATUSES } };
  if (jobId) jobFilter._id = { $ne: jobId };
  if (appointmentId) jobFilter.appointment = { $ne: appointmentId };
  if (await ServiceJob.exists(jobFilter)) return 'This technician already has a job in progress. Choose another technician or wait until that job is completed.';
  if (preferredDate && preferredTime) {
    const day = new Date(preferredDate);
    day.setUTCHours(0, 0, 0, 0);
    const filter = { assignedTechnician: technicianId, status: { $in: ['Pending', 'Confirmed', 'Checked In', 'In Service'] }, preferredDate: { $gte: day, $lt: new Date(day.getTime() + 86400000) }, preferredTime };
    if (appointmentId) filter._id = { $ne: appointmentId };
    if (await Appointment.exists(filter)) return 'This technician is already assigned to another appointment at this date and time. Choose another technician or time.';
  }
  return '';
}
