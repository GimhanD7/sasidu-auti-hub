import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';

const REMINDER_STATUSES = ['Pending', 'Confirmed'];
const CHECK_INTERVAL_MS = 60 * 1000;

function appointmentStart(appointment) {
  const date = appointment.preferredDate.toISOString().slice(0, 10);
  return new Date(`${date}T${appointment.preferredTime}:00`);
}

async function sendDueReminders() {
  const now = new Date();
  const from = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  from.setUTCHours(0, 0, 0, 0);
  const hoursBefore = Number(process.env.APPOINTMENT_REMINDER_HOURS || 24);
  const reminderWindowMs = (Number.isFinite(hoursBefore) && hoursBefore > 0 ? hoursBefore : 24) * 60 * 60 * 1000;
  const lookAheadDays = Math.min(32, Math.ceil(reminderWindowMs / (24 * 60 * 60 * 1000)) + 2);
  const to = new Date(now.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);
  to.setUTCHours(0, 0, 0, 0);
  to.setUTCDate(to.getUTCDate() + 1);
  const dueSoon = await Appointment.find({
    preferredDate: { $gte: from, $lt: to },
    status: { $in: REMINDER_STATUSES },
    reminderSentAt: { $exists: false },
  }).select('customer appointmentNumber serviceType preferredDate preferredTime reminderSentAt').lean();

  for (const appointment of dueSoon) {
    const start = appointmentStart(appointment);
    if (start <= now || start.getTime() - reminderWindowMs > now.getTime()) continue;
    const dedupeKey = `appointment-reminder:${appointment._id}`;
    try {
      await Notification.create({
        user: appointment.customer,
        type: 'AppointmentReminder',
        title: 'Upcoming service appointment',
        message: `${appointment.appointmentNumber}: ${appointment.serviceType} is scheduled for ${appointment.preferredDate.toISOString().slice(0, 10)} at ${appointment.preferredTime}.`,
        link: '/customer/appointments',
        dedupeKey,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
    await Appointment.updateOne({ _id: appointment._id, status: { $in: REMINDER_STATUSES }, reminderSentAt: { $exists: false } }, { $set: { reminderSentAt: now } });
  }
}

export function startAppointmentReminderScheduler() {
  let running = false;
  const check = async () => {
    if (running) return;
    running = true;
    try { await sendDueReminders(); }
    catch { console.error('Appointment reminder check failed. It will retry on the next interval.'); }
    finally { running = false; }
  };
  void check();
  const timer = setInterval(check, CHECK_INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}
