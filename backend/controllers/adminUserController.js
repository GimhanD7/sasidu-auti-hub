import mongoose from 'mongoose';
import User from '../models/User.js';
import { normalizeRole } from '../utils/session.js';

const ROLES = ['Customer', 'Technician', 'Finance', 'Admin'];
const view = user => ({ id: String(user._id), name: user.name, email: user.email, role: normalizeRole(user.role), isActive: user.isActive !== false });

export async function listAdminUsers(req, res) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const filter = {};
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['name', 'email', 'mobile'].map(field => ({ [field]: { $regex: escaped, $options: 'i' } }));
  }
  try {
    const [users, total] = await Promise.all([
      User.find(filter).select('name email role isActive').sort({ name: 1, _id: 1 }).skip((page - 1) * 50).limit(50).lean(),
      User.countDocuments(filter),
    ]);
    res.set('Cache-Control', 'private, no-store').json({ users: users.map(view), page, pages: Math.max(1, Math.ceil(total / 50)), total });
  } catch { res.status(503).json({ message: 'Unable to load accounts. Please try again.' }); }
}

export async function updateAdminUserRole(req, res) {
  const role = req.body?.role;
  if (!mongoose.isValidObjectId(req.params.userId) || !ROLES.includes(role)) return res.status(400).json({ message: 'Select a valid account and role.' });
  if (String(req.user._id) === req.params.userId) return res.status(400).json({ message: 'Ask another administrator to change your role.' });
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.userId },
      { $set: { role }, $inc: { sessionVersion: 1 }, $unset: { resetTokenHash: '', resetTokenExpiresAt: '' } },
      { new: true, runValidators: true },
    ).select('name email role isActive');
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    res.set('Cache-Control', 'private, no-store').json({ user: view(user), message: `${user.name}'s role is now ${role}. They must sign in again.` });
  } catch { res.status(503).json({ message: 'Unable to change this role. Please try again.' }); }
}
