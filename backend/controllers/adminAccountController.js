// Administrator account creation and password resets. Passwords are hashed before storage; session invalidation forces affected users to sign in again.
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { normalizeRole } from '../utils/session.js';

const accountView = user => ({
  id: String(user._id), name: user.name, email: user.email, mobile: user.mobile || '',
  role: normalizeRole(user.role), isActive: user.isActive !== false, createdAt: user.createdAt,
});

export async function createAdminAccount(req, res) {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const mobile = typeof body.mobile === 'string' ? body.mobile.replace(/[\s()-]/g, '') : '';
  const password = body.password;
  const confirmPassword = body.confirmPassword;
  if (name.length < 2 || name.length > 100) return res.status(400).json({ message: 'Name must contain 2 to 100 characters.' });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  if (mobile && !/^\+?\d{10,15}$/.test(mobile)) return res.status(400).json({ message: 'Enter a valid mobile number with 10 to 15 digits.' });
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ message: 'Password must be 8 to 72 bytes long.' });
  if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });
  try {
    if (await User.exists({ $or: [{ email }, ...(mobile ? [{ mobile }] : [])] })) return res.status(409).json({ message: 'An account already exists with this email or mobile.' });
    // Persist user data as a new record in MongoDB; subsequent code uses the stored result.
    const user = await User.create({ name, email, ...(mobile ? { mobile } : {}), password: await bcrypt.hash(password, 10), role: 'Admin', createdBy: req.user._id, passwordChangedAt: new Date(), passwordChangedBy: req.user._id });
    return res.status(201).set('Cache-Control', 'private, no-store').json({ account: accountView(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account already exists with this email or mobile.' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Check the account details and try again.' });
    return res.status(503).json({ message: 'Unable to create the admin account.' });
  }
}

export async function resetAdminAccountPassword(req, res) {
  const { accountId } = req.params;
  const { password, confirmPassword } = req.body || {};
  if (!mongoose.isValidObjectId(accountId)) return res.status(400).json({ message: 'Invalid account.' });
  if (String(req.user._id) === String(accountId)) return res.status(400).json({ message: 'Use your account settings to change your own password.' });
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ message: 'Password must be 8 to 72 bytes long.' });
  if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match.' });
  try {
    const account = await User.findById(accountId).select('+resetTokenHash +resetTokenExpiresAt');
    if (!account) return res.status(404).json({ message: 'Account not found.' });
    account.password = await bcrypt.hash(password, 10);
    account.sessionVersion = (account.sessionVersion || 0) + 1;
    account.resetTokenHash = undefined;
    account.resetTokenExpiresAt = undefined;
    account.passwordChangedAt = new Date();
    account.passwordChangedBy = req.user._id;
    // Persist the changes made to account above; document validation and registered save hooks run here.
    await account.save();
    return res.set('Cache-Control', 'private, no-store').json({ message: `Password updated for ${account.name}. They must sign in again.` });
  } catch { return res.status(503).json({ message: 'Unable to update this account password.' }); }
}
