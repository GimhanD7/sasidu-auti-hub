import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';

const REMINDER_STATUSES = ['Pending', 'Confirmed'];
const CHECK_INTERVAL_MS = 60 * 1000;

function appointmentStart(appointment) {
  const date = appointment.preferredDate.toISOString().slice(0, 10);
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = appointment.preferredTime.split(':').map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day, hour, minute);
  let instant = targetWallTime;
  const timezone = process.env.APPOINTMENT_TIME_ZONE || process.env.TZ || 'Asia/Colombo';
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const values = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const projectedWallTime = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    const correction = targetWallTime - projectedWallTime;
    instant += correction;
    if (correction === 0) break;
  }
  return new Date(instant);
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
    await Appointment.updateOne({ _id: appointment._id, preferredDate: appointment.preferredDate, preferredTime: appointment.preferredTime, status: { $in: REMINDER_STATUSES }, reminderSentAt: { $exists: false } }, { $set: { reminderSentAt: now } });
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
