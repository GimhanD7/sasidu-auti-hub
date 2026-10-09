import ServiceJob from '../models/ServiceJob.js';
import Notification from '../models/Notification.js';
import Appointment from '../models/Appointment.js';

const WORKSHOP_TIME_ZONE = process.env.APPOINTMENT_TIME_ZONE || 'Asia/Colombo';
const OPEN_STATUSES = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test'];

function zonedDayBounds(now = new Date(), timeZone = WORKSHOP_TIME_ZONE) {
  const dateParts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => dateParts.find(item => item.type === type)?.value;
  const target = Date.UTC(Number(part('year')), Number(part('month')) - 1, Number(part('day')));
  const offsetAt = instant => {
    const localParts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant);
    const value = type => Number(localParts.find(item => item.type === type)?.value);
    return Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second')) - instant.getTime();
  };
  const atZoneMidnight = targetUtc => {
    let candidate = new Date(targetUtc);
    for (let attempt = 0; attempt < 2; attempt++) candidate = new Date(targetUtc - offsetAt(candidate));
    return candidate;
  };
  const start = atZoneMidnight(target);
  const end = atZoneMidnight(target + 24 * 60 * 60 * 1000);
  return { start, end };
}

function serializeJob(job) {
  return {
    id: String(job._id),
    serviceNumber: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`,
    status: job.status,
    priority: job.priority || 'Normal',
    complaint: job.customerComplaint || '',
    expectedCompletionTime: job.expectedCompletionTime || null,
    updatedAt: job.updatedAt,
    customer: job.customer?.name || 'Customer unavailable',
    vehicle: job.vehicle ? {
      make: job.vehicle.make, model: job.vehicle.model, year: job.vehicle.year,
      registrationNumber: job.vehicle.registrationNumber,
    } : null,
    serviceType: job.appointment?.serviceType || 'Service repair',
    appointmentDate: job.appointment?.preferredDate || null,
    appointmentTime: job.appointment?.preferredTime || '',
  };
}

export async function getTechnicianDashboard(req, res) {
  try {
    const technicianId = req.user._id;
    const { start, end } = zonedDayBounds();
    const [jobs, assignedCount, inProgressCount, waitingApprovalCount, completedTodayCount, completedCount, highPriorityCount, notifications, unreadNotifications, appointments] = await Promise.all([
      ServiceJob.find({ technician: technicianId })
        .select('serviceNumber status priority customerComplaint expectedCompletionTime updatedAt createdAt timeline')
        .populate({ path: 'customer', select: 'name' })
        .populate({ path: 'vehicle', select: 'make model year registrationNumber' })
        .populate({ path: 'appointment', select: 'serviceType preferredDate preferredTime' })
        .sort({ updatedAt: -1 }).limit(250).lean(),
      ServiceJob.countDocuments({ technician: technicianId, status: 'Inspecting' }),
      ServiceJob.countDocuments({ technician: technicianId, status: 'In Progress' }),
      ServiceJob.countDocuments({ technician: technicianId, status: 'Waiting for Approval' }),
      ServiceJob.countDocuments({ technician: technicianId, timeline: { $elemMatch: { status: 'Ready', timestamp: { $gte: start, $lt: end } } } }),
      ServiceJob.countDocuments({ technician: technicianId, status: 'Ready' }),
      ServiceJob.countDocuments({ technician: technicianId, status: { $in: OPEN_STATUSES }, priority: { $in: ['High', 'Urgent'] } }),
      Notification.find({ user: technicianId }).select('type title message link isRead createdAt').sort({ createdAt: -1 }).limit(5).lean(),
      Notification.countDocuments({ user: technicianId, isRead: false }),
      Appointment.find({ assignedTechnician: technicianId, status: { $in: ['Pending', 'Confirmed', 'Checked In', 'In Service'] } })
        .sort({ preferredDate: 1, preferredTime: 1 })
        .populate({ path: 'customer', select: 'name' })
        .populate({ path: 'vehicle', select: 'make model year registrationNumber' }).lean(),
    ]);
    const linkedJobs = appointments.length
      ? await ServiceJob.find({ appointment: { $in: appointments.map(appointment => appointment._id) } }).select('_id appointment').lean()
      : [];
    const jobByAppointment = new Map(linkedJobs.map(job => [String(job.appointment), String(job._id)]));
    const assignedJobs = jobs.filter(job => OPEN_STATUSES.includes(job.status));
    const todayJobs = assignedJobs.filter(job => job.appointment?.preferredDate >= start && job.appointment?.preferredDate < end);
    const highPriorityJobs = assignedJobs.filter(job => ['High', 'Urgent'].includes(job.priority));
    const activeJob = jobs.find(job => job.status === 'In Progress') || null;
    const completedJobs = jobs.filter(job => job.status === 'Ready').slice(0, 5);

    const appointmentIdSet = new Set(appointments.map(a => String(a._id)));
    const standaloneAssignedJobs = assignedJobs.filter(j => !j.appointment || !appointmentIdSet.has(String(j.appointment._id || j.appointment)));
    const totalAssignedCount = appointments.length + standaloneAssignedJobs.length;

    res.set('Cache-Control', 'private, no-store');
    res.json({
      technician: { fullName: req.user.name },
      summary: {
        assigned: totalAssignedCount || assignedJobs.length || appointments.length || assignedCount,
        inProgress: inProgressCount,
        waitingForApproval: waitingApprovalCount,
        completedToday: completedTodayCount,
        completed: completedCount,
        highPriority: highPriorityCount,
        today: todayJobs.length,
      },
      assignedJobs: assignedJobs.slice(0, 8).map(serializeJob),
      assignedAppointments: appointments.map(appointment => ({
        id: String(appointment._id),
        appointmentNumber: appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`,
        status: appointment.status,
        serviceType: appointment.serviceType,
        preferredDate: appointment.preferredDate,
        preferredTime: appointment.preferredTime,
        customer: appointment.customer?.name || 'Customer unavailable',
        vehicle: appointment.vehicle ? {
          make: appointment.vehicle.make,
          model: appointment.vehicle.model,
          year: appointment.vehicle.year,
          registrationNumber: appointment.vehicle.registrationNumber,
        } : null,
        complaint: appointment.problemDescription || '',
        jobId: jobByAppointment.get(String(appointment._id)) || '',
      })),
      todayJobs: todayJobs.slice(0, 6).map(serializeJob),
      pendingJobs: jobs.filter(job => job.status === 'Inspecting').slice(0, 5).map(serializeJob),
      activeJob: activeJob ? serializeJob(activeJob) : null,
      completedJobs: completedJobs.map(serializeJob),
      highPriorityJobs: highPriorityJobs.slice(0, 5).map(serializeJob),
      notifications: notifications.map(item => ({
        id: String(item._id), type: item.type, title: item.title, message: item.message,
        link: item.link, isRead: item.isRead, createdAt: item.createdAt,
      })),
      unreadNotifications,
    });
  } catch {
    res.status(503).json({ message: 'Unable to load your technician dashboard. Please try again.' });
  }
}
