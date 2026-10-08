import Vehicle from '../models/Vehicle.js';
import Appointment from '../models/Appointment.js';
import ServiceJob from '../models/ServiceJob.js';
import Invoice from '../models/Invoice.js';
import Notification from '../models/Notification.js';
import Message from '../models/Message.js';

export async function getCustomerDashboard(req, res) {
  try {
    const customerId = req.user._id;
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const activeStatuses = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test'];
    const upcomingStatuses = ['Pending', 'Confirmed'];
    const invoiceStatuses = ['Pending', 'Partially Paid', 'Overdue'];
    const [vehicleCount, vehicles, jobs, upcomingAppointments, upcomingAppointmentCount, latestInvoice, outstandingInvoices, notifications, unreadNotificationCount, unreadMessageCount, activeRepairCount, activeJobIds] = await Promise.all([
      Vehicle.countDocuments({ customer: customerId }),
      Vehicle.find({ customer: customerId }).select('make model year registrationNumber').sort({ createdAt: -1 }).limit(5).lean(),
      ServiceJob.find({ customer: customerId, status: { $in: activeStatuses } })
        .select('vehicle status expectedCompletionTime createdAt')
        .sort({ expectedCompletionTime: 1, createdAt: -1 }).limit(3)
        .populate({ path: 'vehicle', select: 'make model year registrationNumber' }).lean(),
      Appointment.find({ customer: customerId, preferredDate: { $gte: startOfToday }, status: { $in: upcomingStatuses } })
        .select('vehicle serviceType preferredDate preferredTime status assignedTechnician')
        .sort({ preferredDate: 1 }).limit(1)
        .populate({ path: 'vehicle', select: 'make model year registrationNumber' })
        .populate({ path: 'assignedTechnician', select: 'name' }).lean(),
      Appointment.countDocuments({ customer: customerId, preferredDate: { $gte: startOfToday }, status: { $in: upcomingStatuses } }),
      Invoice.findOne({ customer: customerId, paymentStatus: { $nin: ['Draft', 'Cancelled'] } })
        .select('invoiceNumber totalAmount paymentStatus createdAt').sort({ createdAt: -1 }).lean(),
      Invoice.countDocuments({ customer: customerId, paymentStatus: { $in: invoiceStatuses } }),
      Notification.find({ user: customerId }).select('type title message link isRead createdAt')
        .sort({ createdAt: -1 }).limit(5).lean(),
      Notification.countDocuments({ user: customerId, isRead: false }),
      Message.countDocuments({ receiver: customerId, sender: { $ne: customerId }, isRead: false }),
      ServiceJob.countDocuments({ customer: customerId, status: { $in: activeStatuses } }),
      ServiceJob.distinct('_id', { customer: customerId }),
    ]);

    const unreadJobMessageCount = activeJobIds.length
      ? await Message.countDocuments({ serviceJob: { $in: activeJobIds }, sender: { $ne: customerId }, isRead: false, receiver: { $exists: false } })
      : 0;
    res.set('Cache-Control', 'private, no-store');
    res.json({
      customer: { fullName: req.user.name, email: req.user.email, mobile: req.user.mobile || '' },
      summary: { vehicles: vehicleCount, activeRepairs: activeRepairCount, upcomingAppointments: upcomingAppointmentCount, outstandingInvoices },
      vehicles: vehicles.map(vehicle => ({ id: vehicle._id, make: vehicle.make, model: vehicle.model, year: vehicle.year, registrationNumber: vehicle.registrationNumber })),
      activeJobs: jobs.map(job => ({
        id: job._id, status: job.status, expectedCompletionTime: job.expectedCompletionTime || null,
        vehicle: job.vehicle ? { make: job.vehicle.make, model: job.vehicle.model, year: job.vehicle.year, registrationNumber: job.vehicle.registrationNumber } : null,
      })),
      upcomingAppointment: upcomingAppointments[0] ? {
        serviceType: upcomingAppointments[0].serviceType, preferredDate: upcomingAppointments[0].preferredDate,
        preferredTime: upcomingAppointments[0].preferredTime, status: upcomingAppointments[0].status,
        technician: upcomingAppointments[0].assignedTechnician?.name || null,
        vehicle: upcomingAppointments[0].vehicle ? {
          make: upcomingAppointments[0].vehicle.make, model: upcomingAppointments[0].vehicle.model,
          year: upcomingAppointments[0].vehicle.year, registrationNumber: upcomingAppointments[0].vehicle.registrationNumber,
        } : null,
      } : null,
      latestInvoice: latestInvoice ? {
        invoiceNumber: latestInvoice.invoiceNumber, totalAmount: latestInvoice.totalAmount,
        paymentStatus: latestInvoice.paymentStatus, createdAt: latestInvoice.createdAt,
      } : null,
      notifications: notifications.map(item => ({
        id: item._id, type: item.type, title: item.title, message: item.message,
        link: item.link, isRead: item.isRead, createdAt: item.createdAt,
      })),
      unreadNotifications: unreadNotificationCount,
      unreadMessages: unreadMessageCount + unreadJobMessageCount,
    });
  } catch {
    res.status(503).json({ message: 'Unable to load your dashboard. Please try again.' });
  }
}
