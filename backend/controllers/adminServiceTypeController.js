// Manage the bookable service catalog. Deactivation hides a service from booking; deletion marks it deleted while retaining its database record.
import mongoose from 'mongoose';
import ServiceType from '../models/ServiceType.js';

export const DEFAULT_SERVICE_TYPES = [
  { name: 'Full Service', defaultDurationMinutes: 180, estimatedCost: 25000, requiredSkill: 'General Maintenance' },
  { name: 'Oil Change', defaultDurationMinutes: 60, estimatedCost: 8000, requiredSkill: 'General Maintenance' },
  { name: 'Brake Service', defaultDurationMinutes: 120, estimatedCost: 18000, requiredSkill: 'Brake Systems' },
  { name: 'Engine Diagnosis', defaultDurationMinutes: 90, estimatedCost: 12000, requiredSkill: 'Engine Diagnostics' },
  { name: 'Electrical Diagnosis', defaultDurationMinutes: 90, estimatedCost: 12000, requiredSkill: 'Auto Electrical' },
  { name: 'General Repair', defaultDurationMinutes: 120, estimatedCost: 15000, requiredSkill: 'General Repair' },
];

// Seed defaults only when the catalog is empty; upserts avoid creating the same named defaults twice.
export async function ensureDefaultServiceTypes() {
  if (await ServiceType.exists({})) return;
  // Apply the specified service type database changes only to records matching this filter.
  await ServiceType.bulkWrite(DEFAULT_SERVICE_TYPES.map(item => ({ updateOne: { filter: { name: item.name }, update: { $setOnInsert: item }, upsert: true } })), { ordered: false });
}

const validInput = body => {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const requiredSkill = typeof body?.requiredSkill === 'string' ? body.requiredSkill.trim() : '';
  const duration = Number(body?.defaultDurationMinutes);
  const cost = Number(body?.estimatedCost);
  if (!name || name.length > 100 || !requiredSkill || requiredSkill.length > 100 || !Number.isInteger(duration) || duration < 15 || duration > 1440 || !Number.isFinite(cost) || cost < 0 || cost > 10000000) return null;
  return { name, requiredSkill, defaultDurationMinutes: duration, estimatedCost: cost };
};

export async function listAdminServiceTypes(req, res) {
  try {
    await ensureDefaultServiceTypes();
    const serviceTypes = await ServiceType.find({ isDeleted: { $ne: true } }).sort({ isActive: -1, name: 1 }).lean();
    res.set('Cache-Control', 'private, no-store').json({ serviceTypes: serviceTypes.map(item => ({ id: String(item._id), name: item.name, defaultDurationMinutes: item.defaultDurationMinutes, estimatedCost: item.estimatedCost, requiredSkill: item.requiredSkill, isActive: item.isActive })) });
  } catch { res.status(503).json({ message: 'Unable to load service types.' }); }
}

export async function createAdminServiceType(req, res) {
  const input = validInput(req.body);
  if (!input) return res.status(400).json({ message: 'Enter a name, skill, duration from 15 to 1,440 minutes, and a non-negative estimated cost.' });
  try {
    await ensureDefaultServiceTypes();
    // Persist service type data as a new record in MongoDB; subsequent code uses the stored result.
    const serviceType = await ServiceType.create(input);
    res.status(201).json({ serviceType: { id: String(serviceType._id), ...input, isActive: true } });
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 503).json({ message: error.code === 11000 ? 'A service type with this name already exists.' : 'Unable to create the service type.' });
  }
}

export async function updateAdminServiceType(req, res) {
  const input = validInput(req.body);
  if (!input) return res.status(400).json({ message: 'Enter a name, skill, duration from 15 to 1,440 minutes, and a non-negative estimated cost.' });
  try {
    await ensureDefaultServiceTypes();
    // Apply the specified service type database changes only to records matching this filter.
    const serviceType = await ServiceType.findByIdAndUpdate(req.params.serviceTypeId, { ...input }, { new: true, runValidators: true });
    if (!serviceType) return res.status(404).json({ message: 'Service type not found.' });
    res.json({ serviceType: { id: String(serviceType._id), name: serviceType.name, defaultDurationMinutes: serviceType.defaultDurationMinutes, estimatedCost: serviceType.estimatedCost, requiredSkill: serviceType.requiredSkill, isActive: serviceType.isActive } });
  } catch (error) { res.status(error.code === 11000 ? 409 : 503).json({ message: error.code === 11000 ? 'A service type with this name already exists.' : 'Unable to update the service type.' }); }
}

// Keep the service in the catalog but make it unavailable for new bookings.
export async function deactivateAdminServiceType(req, res) {
  try {
    await ensureDefaultServiceTypes();
    // Apply the specified service type database changes only to records matching this filter.
    const serviceType = await ServiceType.findByIdAndUpdate(req.params.serviceTypeId, { isActive: false }, { new: true });
    if (!serviceType) return res.status(404).json({ message: 'Service type not found.' });
    res.json({ serviceType: { id: String(serviceType._id), isActive: serviceType.isActive } });
  } catch { res.status(503).json({ message: 'Unable to deactivate the service type.' }); }
}

// Re-enable a service only if it has not been marked deleted.
export async function activateAdminServiceType(req, res) {
  if (!mongoose.isValidObjectId(req.params.serviceTypeId)) return res.status(400).json({ message: 'Invalid service type.' });
  try {
    await ensureDefaultServiceTypes();
    // Apply the specified service type database changes only to records matching this filter.
    const serviceType = await ServiceType.findOneAndUpdate(
      { _id: req.params.serviceTypeId, isDeleted: { $ne: true } },
      { isActive: true },
      { new: true }
    );
    if (!serviceType) return res.status(404).json({ message: 'Service type not found.' });
    res.json({ serviceType: { id: String(serviceType._id), isActive: serviceType.isActive } });
  } catch { res.status(503).json({ message: 'Unable to activate the service type.' }); }
}

export async function getActiveServiceTypeNames() {
  await ensureDefaultServiceTypes();
  return (await ServiceType.find({ isActive: true, isDeleted: { $ne: true } }).select('name').sort({ name: 1 }).lean()).map(item => item.name);
}

// Soft-delete the catalog entry so it stops appearing in new bookings while existing service history remains intact.
export async function deleteAdminServiceType(req, res) {
  if (!mongoose.isValidObjectId(req.params.serviceTypeId)) return res.status(400).json({ message: 'Invalid service type.' });
  try {
    // Apply the specified service type database changes only to records matching this filter.
    const item = await ServiceType.findOneAndUpdate({ _id: req.params.serviceTypeId, isDeleted: { $ne: true } }, { isActive: false, isDeleted: true });
    if (!item) return res.status(404).json({ message: 'Service type not found.' });
    res.json({ message: 'Service type deleted. Existing service history is preserved.' });
  } catch { res.status(503).json({ message: 'Unable to delete service type.' }); }
}
