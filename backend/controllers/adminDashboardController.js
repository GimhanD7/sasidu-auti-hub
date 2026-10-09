import Appointment from '../models/Appointment.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import ServiceJob from '../models/ServiceJob.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

const ACTIVE_JOB_STATUSES = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test', 'Ready'];

export async function getAdminDashboard(req, res) {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const appointmentBase = { status: { $nin: ['Cancelled', 'Completed'] } };
    const activeJobsFilter = { status: { $in: ACTIVE_JOB_STATUSES } };
    const [todayAppointments, pendingAppointments, upcomingAppointments, appointmentList, activeJobs, stageCounts, vehiclesInWorkshop, technicians, jobsAwaitingApproval, dailyRevenue, recentJobs, recentAppointments] = await Promise.all([
      Appointment.countDocuments({ ...appointmentBase, preferredDate: { $gte: startOfToday, $lt: startOfTomorrow } }),
      Appointment.countDocuments({ status: 'Pending', preferredDate: { $gte: startOfToday } }),
      Appointment.countDocuments({ ...appointmentBase, preferredDate: { $gte: startOfTomorrow } }),
      Appointment.find({ ...appointmentBase, preferredDate: { $gte: startOfToday } }).sort({ preferredDate: 1, preferredTime: 1 }).limit(8)
        .populate({ path: 'customer', select: 'name' }).populate({ path: 'vehicle', select: 'make model registrationNumber' }).lean(),
      ServiceJob.find(activeJobsFilter).sort({ updatedAt: -1 }).limit(8)
        .populate({ path: 'customer', select: 'name' }).populate({ path: 'vehicle', select: 'make model registrationNumber' }).populate({ path: 'technician', select: 'name' }).lean(),
      ServiceJob.aggregate([{ $match: activeJobsFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      ServiceJob.distinct('vehicle', activeJobsFilter),
      User.find({ role: 'Technician', isActive: { $ne: false } }).select('name email availabilityStatus').sort({ name: 1 }).lean(),
      ServiceJob.find({ status: 'Waiting for Approval' }).sort({ updatedAt: -1 }).limit(5)
        .populate({ path: 'customer', select: 'name' }).populate({ path: 'vehicle', select: 'make model registrationNumber' }).lean(),
      Payment.aggregate([{ $match: { status: 'Completed', reviewedAt: { $gte: startOfToday, $lt: startOfTomorrow } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      ServiceJob.find().sort({ updatedAt: -1 }).limit(5).select('serviceNumber status updatedAt vehicle').populate({ path: 'vehicle', select: 'make model registrationNumber' }).lean(),
      Appointment.find().sort({ updatedAt: -1 }).limit(5).select('appointmentNumber status updatedAt vehicle').populate({ path: 'vehicle', select: 'make model registrationNumber' }).lean(),
    ]);

    const countFor = status => stageCounts.find(stage => stage._id === status)?.count || 0;
    const activity = [
      ...recentJobs.map(job => ({ id: String(job._id), kind: 'job', reference: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`, status: job.status, vehicle: job.vehicle ? `${job.vehicle.make} ${job.vehicle.model} (${job.vehicle.registrationNumber})` : 'Vehicle unavailable', updatedAt: job.updatedAt })),
      ...recentAppointments.map(appointment => ({ id: String(appointment._id), kind: 'appointment', reference: appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`, status: appointment.status, vehicle: appointment.vehicle ? `${appointment.vehicle.make} ${appointment.vehicle.model} (${appointment.vehicle.registrationNumber})` : 'Vehicle unavailable', updatedAt: appointment.updatedAt })),
    ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 8);

    res.set('Cache-Control', 'private, no-store').json({
      summary: {
        todayAppointments, pendingAppointments, upcomingAppointments, activeJobs: stageCounts.reduce((total, stage) => total + stage.count, 0),
        vehiclesInWorkshop: vehiclesInWorkshop.length, techniciansAvailable: technicians.filter(technician => (technician.availabilityStatus || 'Available') === 'Available').length,
        techniciansBusy: technicians.filter(technician => (technician.availabilityStatus || 'Available') !== 'Available').length,
        inspecting: countFor('Inspecting'), inProgress: countFor('In Progress'), finalTest: countFor('Final Test'), ready: countFor('Ready'),
        dailyRevenue: Math.round((dailyRevenue[0]?.total || 0) * 100) / 100,
      },
      appointments: appointmentList.map(appointment => ({
        id: String(appointment._id), reference: appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`,
        customer: appointment.customer?.name || 'Customer', vehicle: appointment.vehicle ? `${appointment.vehicle.make} ${appointment.vehicle.model}` : 'Vehicle unavailable',
        registrationNumber: appointment.vehicle?.registrationNumber || '', serviceType: appointment.serviceType, preferredDate: appointment.preferredDate,
        preferredTime: appointment.preferredTime, status: appointment.status,
      })),
      activeJobs: activeJobs.map(job => ({
        id: String(job._id), reference: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`, status: job.status,
        customer: job.customer?.name || 'Customer', vehicle: job.vehicle ? `${job.vehicle.make} ${job.vehicle.model}` : 'Vehicle unavailable',
        registrationNumber: job.vehicle?.registrationNumber || '', technician: job.technician?.name || 'Unassigned', updatedAt: job.updatedAt,
      })),
      technicians: technicians.map(technician => ({ id: String(technician._id), name: technician.name, email: technician.email, status: technician.availabilityStatus || 'Available' })),
      jobsAwaitingApproval: jobsAwaitingApproval.map(job => ({
        id: String(job._id), reference: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`,
        vehicle: job.vehicle ? `${job.vehicle.make} ${job.vehicle.model}` : 'Vehicle unavailable', customer: job.customer?.name || 'Customer',
        pendingRepairs: (job.additionalRepairs || []).filter(repair => repair.status === 'Pending').length,
      })),
      recentActivity: activity,
    });
  } catch {
    res.status(503).json({ message: 'Unable to load the workshop dashboard. Please try again.' });
  }
}

export async function listAdminAppointments(req, res) {
  const { start, end, status, technician } = req.query;
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if ((start && Number.isNaN(startDate.getTime())) || (end && Number.isNaN(endDate.getTime())) || (startDate && endDate && startDate >= endDate)) {
    return res.status(400).json({ message: 'Choose a valid appointment date range.' });
  }
  const filter = {};
  if (startDate && endDate) {
    filter.preferredDate = { $gte: startDate, $lt: endDate };
  } else if (startDate) {
    filter.preferredDate = { $gte: startDate };
  } else if (endDate) {
    filter.preferredDate = { $lt: endDate };
  }
  const allowedStatuses = ['Pending', 'Confirmed', 'Checked In', 'In Service', 'Completed', 'Cancelled'];
  if (status) {
    if (!allowedStatuses.includes(status)) return res.status(400).json({ message: 'Choose a valid appointment status.' });
    filter.status = status;
  }
  if (technician) {
    if (!mongoose.isValidObjectId(technician)) return res.status(400).json({ message: 'Choose a valid technician.' });
    filter.assignedTechnician = technician;
  }
  try {
    const configuredDays = process.env.APPOINTMENT_BUSINESS_DAYS?.split(',').map(Number).filter(day => Number.isInteger(day) && day >= 1 && day <= 7);
    const businessDays = new Set(configuredDays?.length ? configuredDays : [1, 2, 3, 4, 5, 6, 7]);
    const [appointments, technicians, bookedSlots] = await Promise.all([
      Appointment.find(filter).sort({ preferredDate: 1, preferredTime: 1 }).limit(1000)
        .populate({ path: 'customer', select: 'name email mobile' }).populate({ path: 'vehicle', select: 'make model registrationNumber' })
        .populate({ path: 'assignedTechnician', select: 'name' }).lean(),
      User.find({ role: 'Technician', isActive: { $ne: false } }).select('name availabilityStatus').sort({ name: 1 }).lean(),
      Appointment.find({ ...(startDate && endDate ? { preferredDate: { $gte: startDate, $lt: endDate } } : {}), status: { $in: ['Pending', 'Confirmed', 'Checked In', 'In Service'] } })
        .select('preferredDate preferredTime').lean(),
    ]);
    const bookedCounts = new Map();
    for (const item of bookedSlots) {
      const key = `${item.preferredDate.toISOString().slice(0, 10)}|${item.preferredTime}`;
      bookedCounts.set(key, (bookedCounts.get(key) || 0) + 1);
    }
    const availability = [];
    const availStart = startDate || new Date();
    const availEnd = endDate || new Date(availStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    for (let day = new Date(availStart); day < availEnd; day.setUTCDate(day.getUTCDate() + 1)) {
      const date = day.toISOString().slice(0, 10);
      const businessDay = businessDays.has(day.getUTCDay() || 7);
      const times = [...bookedCounts.keys()].filter(key => key.startsWith(date + '|')).map(key => key.split('|')[1]).sort();
      const slots = times.map(time => ({
        time,
        count: bookedCounts.get(`${date}|${time}`) || 0,
        status: !businessDay ? 'Closed' : bookedCounts.has(`${date}|${time}`) ? 'Booked' : new Date(`${date}T${time}:00.000Z`) > new Date() ? 'Available' : 'Past',
      }));
      availability.push({
        date, closed: !businessDay,
        bookedCount: slots.reduce((total, slot) => total + Math.min(slot.count, 1), 0),
        overlapCount: slots.reduce((total, slot) => total + Math.max(0, slot.count - 1), 0),
        slots,
      });
    }
    res.set('Cache-Control', 'private, no-store').json({
      appointments: appointments.map(appointment => ({
        id: String(appointment._id), reference: appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`,
        customer: appointment.customer?.name || 'Customer', email: appointment.customer?.email || '',
        vehicle: appointment.vehicle ? `${appointment.vehicle.make} ${appointment.vehicle.model}` : 'Vehicle unavailable',
        registrationNumber: appointment.vehicle?.registrationNumber || '', serviceType: appointment.serviceType,
        preferredDate: appointment.preferredDate, preferredTime: appointment.preferredTime, status: appointment.status,
        technicianId: appointment.assignedTechnician ? String(appointment.assignedTechnician._id) : '',
        technician: appointment.assignedTechnician?.name || 'Unassigned',
        overlap: (bookedCounts.get(`${appointment.preferredDate.toISOString().slice(0, 10)}|${appointment.preferredTime}`) || 0) > 1,
      })),
      technicians: technicians.map(person => ({ id: String(person._id), name: person.name, availabilityStatus: person.availabilityStatus || 'Available' })),
      availability,
    });
  } catch {
    res.status(503).json({ message: 'Unable to load appointments. Please try again.' });
  }
}
