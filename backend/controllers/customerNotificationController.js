import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

export async function listCustomerNotifications(req, res) {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .select('type title message link isRead createdAt')
      .sort({ createdAt: -1 }).limit(100).lean();
    const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
    res.set('Cache-Control', 'private, no-store').json({
      unreadCount,
      notifications: notifications.map(item => ({ id: String(item._id), type: item.type, title: item.title, message: item.message, link: item.link || '', isRead: item.isRead, createdAt: item.createdAt })),
    });
  } catch {
    res.status(503).json({ message: 'Unable to load your notifications. Please try again.' });
  }
}

export async function markCustomerNotificationRead(req, res) {
  if (!mongoose.isValidObjectId(req.params.notificationId)) return res.status(400).json({ message: 'Invalid notification.' });
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, user: req.user._id },
      { $set: { isRead: true } },
      { new: true },
    ).select('_id isRead');
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    res.json({ id: String(notification._id), isRead: notification.isRead });
  } catch {
    res.status(503).json({ message: 'Unable to update this notification. Please try again.' });
  }
}

export async function markAllCustomerNotificationsRead(req, res) {
  try {
    const result = await Notification.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true } });
    res.json({ markedRead: result.modifiedCount });
  } catch {
    res.status(503).json({ message: 'Unable to update your notifications. Please try again.' });
  }
}
