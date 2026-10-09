import AuthSession from '../models/AuthSession.js';
import User from '../models/User.js';
import { readSessionToken, hashToken, normalizeRole } from '../utils/session.js';

export async function requireAuth(req, res, next) {
  const token = readSessionToken(req);
  if (!token) return res.status(401).json({ message: 'Please sign in to continue.' });
  try {
    const session = await AuthSession.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
    const user = session && await User.findById(session.user).select('-password -resetTokenHash -resetTokenExpiresAt');
    if (!user || !['user', 'admin', 'Customer', 'Admin', 'Technician'].includes(user.role) || user.isActive === false || session.version !== (user.sessionVersion || 0)) return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    req.user = user;
    next();
  } catch {
    res.status(503).json({ message: 'Unable to verify your session. Please try again.' });
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(normalizeRole(req.user.role))) return res.status(403).json({ message: 'Access denied.' });
  next();
};
