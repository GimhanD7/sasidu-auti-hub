// Manage vehicles owned by the signed-in customer. Related appointments or service history prevent permanent vehicle deletion.
import { validVehicleImage } from '../utils/vehicleImage.js';
import mongoose from 'mongoose';
import Vehicle from '../models/Vehicle.js';
import Appointment from '../models/Appointment.js';
import ServiceJob from '../models/ServiceJob.js';
import Invoice from '../models/Invoice.js';

function normalizeRegistration(value) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function validateVehicle(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Enter the vehicle details.' };
  const { registrationNumber, make, model, year, fuelType, mileage, vinNumber, imageUrl } = body;
  if ([registrationNumber, make, model].some(value => typeof value !== 'string')) return { error: 'Registration number, make and model are required.' };

  const data = {
    registrationNumber: normalizeRegistration(registrationNumber),
    make: make.trim(),
    model: model.trim(),
    fuelType: typeof fuelType === 'string' ? fuelType.trim() : '',
    vinNumber: typeof vinNumber === 'string' ? vinNumber.trim().toUpperCase() : '',
    imageUrl: typeof imageUrl === 'string' ? imageUrl.trim() : '',
  };
  if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(data.registrationNumber)) {
    return { error: 'Enter a registration number using 2 to 20 letters, numbers or hyphens.' };
  }
  if (!data.make || data.make.length > 80 || !data.model || data.model.length > 80) {
    return { error: 'Make and model are required and must each be 80 characters or fewer.' };
  }
  if (data.fuelType.length > 50) return { error: 'Fuel type must be 50 characters or fewer.' };
  if (data.vinNumber && !/^[A-Z0-9 -]{1,32}$/.test(data.vinNumber)) return { error: 'Enter a valid VIN/chassis number (up to 32 letters, numbers or hyphens).' };

  if (year !== undefined && year !== null && year !== '') {
    data.year = Number(year);
    if (!Number.isInteger(data.year) || data.year < 1886 || data.year > new Date().getFullYear() + 1) {
      return { error: `Enter a valid model year from 1886 to ${new Date().getFullYear() + 1}.` };
    }
  }
  if (mileage !== undefined && mileage !== null && mileage !== '') {
    data.mileage = Number(mileage);
    if (!Number.isFinite(data.mileage) || data.mileage < 0 || data.mileage > 99999999) {
      return { error: 'Mileage must be a number from 0 to 99,999,999.' };
    }
  }
  if (!validVehicleImage(data.imageUrl)) return { error: 'Use an HTTPS image URL or a JPG/PNG image up to 1 MB.' };
  return { data };
}

function validId(id) {
  return mongoose.isValidObjectId(id);
}

async function hasExistingRegistration(registrationNumber, excludedId = null) {
  const expression = `^${registrationNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
  const filter = { registrationNumber: { $regex: expression, $options: 'i' } };
  if (excludedId) filter._id = { $ne: excludedId };
  return Boolean(await Vehicle.exists(filter));
}

export async function listCustomerVehicles(req, res) {
  try {
    const vehicles = await Vehicle.find({ customer: req.user._id }).sort({ createdAt: -1 }).lean();
    res.set('Cache-Control', 'private, no-store').json(vehicles.map(vehicle => ({ ...vehicle, id: vehicle._id })));
  } catch {
    res.status(503).json({ message: 'Unable to load your vehicles. Please try again.' });
  }
}

export async function getCustomerVehicle(req, res) {
  if (!validId(req.params.vehicleId)) return res.status(400).json({ message: 'Invalid vehicle ID.' });
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.vehicleId, customer: req.user._id }).lean();
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    res.set('Cache-Control', 'private, no-store').json({ ...vehicle, id: vehicle._id });
  } catch {
    res.status(503).json({ message: 'Unable to load this vehicle. Please try again.' });
  }
}

// Join this customer vehicle with repair jobs, recent appointments, and issued invoices for the profile screen.
export async function getCustomerVehicleProfile(req, res) {
  if (!validId(req.params.vehicleId)) return res.status(400).json({ message: 'Invalid vehicle ID.' });
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.vehicleId, customer: req.user._id }).lean();
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });

    const [jobs, appointments] = await Promise.all([
      ServiceJob.find({ vehicle: vehicle._id, customer: req.user._id })
        .sort({ createdAt: -1 })
        .populate({ path: 'technician', select: 'name' })
        .populate({ path: 'appointment', select: 'serviceType preferredDate preferredTime status' })
        .lean(),
      Appointment.find({ vehicle: vehicle._id, customer: req.user._id })
        .select('serviceType preferredDate preferredTime status')
        .sort({ preferredDate: -1 }).limit(10).lean(),
    ]);
    const jobIds = jobs.map(job => job._id);
    const invoices = jobIds.length
      ? await Invoice.find({ customer: req.user._id, serviceJob: { $in: jobIds }, paymentStatus: { $ne: 'Draft' } })
        .select('serviceJob invoiceNumber partsCost labourCost additionalRepairsCost tax discount totalAmount paymentStatus paymentDate createdAt')
        .sort({ createdAt: -1 }).lean()
      : [];
    const invoicesByJob = new Map(invoices.map(invoice => [String(invoice.serviceJob), invoice]));
    const activeStatuses = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test'];
    const currentRepairs = jobs.filter(job => activeStatuses.includes(job.status));
    const history = jobs.filter(job => !activeStatuses.includes(job.status) && job.status !== 'Cancelled');
    const lastService = history.find(job => job.mileageAtService != null) || null;
    const latestRecommendations = history.find(job => job.recommendations?.length)?.recommendations || [];

    res.set('Cache-Control', 'private, no-store').json({
      vehicle: { ...vehicle, id: vehicle._id },
      currentRepairs: currentRepairs.map(job => ({
        id: job._id, status: job.status, priority: job.priority,
        expectedCompletionTime: job.expectedCompletionTime || null,
        technician: job.technician?.name || null,
        serviceType: job.appointment?.serviceType || 'Service repair',
        updatedAt: job.updatedAt,
      })),
      history: history.map(job => ({
        id: job._id, status: job.status, priority: job.priority,
        serviceType: job.appointment?.serviceType || 'Service repair',
        serviceDate: job.timeline?.slice().reverse().find(event => event.status === 'Ready')?.timestamp || job.updatedAt || job.createdAt,
        mileageAtService: job.mileageAtService ?? null,
        technician: job.technician?.name || null,
        timeline: job.timeline || [],
        recommendations: job.recommendations || [],
        documents: job.documents || [],
        invoice: invoicesByJob.get(String(job._id)) || null,
      })),
      appointments,
      lastServiceMileage: lastService?.mileageAtService ?? null,
      recommendations: latestRecommendations,
    });
  } catch {
    res.status(503).json({ message: 'Unable to load this vehicle profile. Please try again.' });
  }
}

// Validate the input and attach ownership from the authenticated account rather than accepting a customer ID from the browser.
export async function createCustomerVehicle(req, res) {
  const { data, error } = validateVehicle(req.body);
  if (error) return res.status(400).json({ message: error });
  try {
    if (await hasExistingRegistration(data.registrationNumber)) {
      return res.status(409).json({ message: 'That registration number is already registered.' });
    }
    // Persist vehicle data as a new record in MongoDB; subsequent code uses the stored result.
    const vehicle = await Vehicle.create({ ...data, customer: req.user._id });
    res.status(201).json({ ...vehicle.toObject(), id: vehicle._id });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'That registration number is already registered.' });
    if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ message: 'Check the vehicle details and try again.' });
    res.status(503).json({ message: 'Unable to save this vehicle. Please try again.' });
  }
}

// Restrict the lookup to the current owner and reject a registration number already used by another vehicle.
export async function updateCustomerVehicle(req, res) {
  if (!validId(req.params.vehicleId)) return res.status(400).json({ message: 'Invalid vehicle ID.' });
  const { data, error } = validateVehicle(req.body);
  if (error) return res.status(400).json({ message: error });
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.vehicleId, customer: req.user._id });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    if (await hasExistingRegistration(data.registrationNumber, vehicle._id)) {
      return res.status(409).json({ message: 'That registration number is already registered.' });
    }
    Object.assign(vehicle, data);
    // Persist the changes made to vehicle above; document validation and registered save hooks run here.
    await vehicle.save();
    res.json({ ...vehicle.toObject(), id: vehicle._id });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'That registration number is already registered.' });
    if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ message: 'Check the vehicle details and try again.' });
    res.status(503).json({ message: 'Unable to update this vehicle. Please try again.' });
  }
}

// Reject deletion when any appointment or service job references this vehicle, preserving linked history.
export async function deleteCustomerVehicle(req, res) {
  if (!validId(req.params.vehicleId)) return res.status(400).json({ message: 'Invalid vehicle ID.' });
  try {
    const vehicle = await Vehicle.findOne({ _id: req.params.vehicleId, customer: req.user._id });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });

    const [appointmentExists, serviceJobExists] = await Promise.all([
      Appointment.exists({ vehicle: vehicle._id }),
      ServiceJob.exists({ vehicle: vehicle._id }),
    ]);
    if (appointmentExists || serviceJobExists) {
      return res.status(409).json({ message: 'This vehicle has service history or appointments and cannot be removed. You can edit its details instead.' });
    }
    await vehicle.deleteOne();
    res.json({ message: 'Vehicle removed.' });
  } catch {
    res.status(503).json({ message: 'Unable to remove this vehicle. Please try again.' });
  }
}
