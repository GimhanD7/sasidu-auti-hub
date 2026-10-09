// Administrative vehicle lookup and editing, including validation of registration details and the linked customer.
import { validVehicleImage } from '../utils/vehicleImage.js';
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Invoice from '../models/Invoice.js';
import ServiceJob from '../models/ServiceJob.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';

const CUSTOMER_ROLES = ['Customer', 'user'];
const CURRENT_JOB_STATUSES = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test', 'Ready'];
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseVehicle(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Enter the vehicle details.' };
  const registrationNumber = typeof body.registrationNumber === 'string' ? body.registrationNumber.trim().toUpperCase().replace(/\s+/g, '') : '';
  const make = typeof body.make === 'string' ? body.make.trim() : '';
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  const year = body.year === '' || body.year == null ? undefined : Number(body.year);
  const mileage = body.mileage === '' || body.mileage == null ? undefined : Number(body.mileage);
  const fuelType = typeof body.fuelType === 'string' ? body.fuelType.trim() : '';
  const vinNumber = typeof body.vinNumber === 'string' ? body.vinNumber.trim().toUpperCase() : '';
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
  if (registrationNumber.length < 2 || registrationNumber.length > 32) return { error: 'Enter a valid registration number.' };
  if (make.length < 1 || make.length > 80 || model.length < 1 || model.length > 80) return { error: 'Make and model must contain 1 to 80 characters.' };
  if (year !== undefined && (!Number.isInteger(year) || year < 1886 || year > new Date().getUTCFullYear() + 1)) return { error: 'Enter a valid vehicle year.' };
  if (mileage !== undefined && (!Number.isFinite(mileage) || mileage < 0 || mileage > 10000000)) return { error: 'Mileage must be a non-negative number.' };
  if (fuelType.length > 50 || vinNumber.length > 32) return { error: 'Fuel type, VIN, or image URL is too long.' };
  if (!validVehicleImage(imageUrl)) return { error: 'Use an HTTPS image URL or a JPG/PNG image up to 1 MB.' };
  return { data: { registrationNumber, make, model, year, mileage, fuelType, vinNumber, imageUrl } };
}

async function findCustomer(customerId) {
  if (!mongoose.isValidObjectId(customerId)) return null;
  return User.findOne({ _id: customerId, role: { $in: CUSTOMER_ROLES }, isActive: { $ne: false } }).select('_id name email mobile');
}

export async function listAdminVehicles(req, res) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = 50;
  const filter = {};
  try {
    if (search) {
      const expression = escapeRegex(search);
      const matchingCustomers = await User.find({ role: { $in: CUSTOMER_ROLES }, $or: [{ name: { $regex: expression, $options: 'i' } }, { email: { $regex: expression, $options: 'i' } }, { mobile: { $regex: expression, $options: 'i' } }] }).select('_id').limit(200).lean();
      filter.$or = [
        { registrationNumber: { $regex: expression, $options: 'i' } },
        { make: { $regex: expression, $options: 'i' } },
        { model: { $regex: expression, $options: 'i' } },
        ...(matchingCustomers.length ? [{ customer: { $in: matchingCustomers.map(item => item._id) } }] : []),
      ];
    }
    const [vehicles, total] = await Promise.all([
      Vehicle.find(filter).sort({ registrationNumber: 1 }).skip((page - 1) * limit).limit(limit)
        .populate({ path: 'customer', select: 'name email mobile' }).lean(),
      Vehicle.countDocuments(filter),
    ]);
    res.set('Cache-Control', 'private, no-store').json({ vehicles: vehicles.map(vehicle => ({
      id: String(vehicle._id), registrationNumber: vehicle.registrationNumber, make: vehicle.make, model: vehicle.model,
      year: vehicle.year || null, mileage: vehicle.mileage ?? null,
      customer: vehicle.customer ? { id: String(vehicle.customer._id), name: vehicle.customer.name, email: vehicle.customer.email, mobile: vehicle.customer.mobile || '' } : null,
    })), page, pages: Math.ceil(total / limit), total });
  } catch { res.status(503).json({ message: 'Unable to load vehicles. Please try again.' }); }
}

export async function getAdminVehicle(req, res) {
  if (!mongoose.isValidObjectId(req.params.vehicleId)) return res.status(400).json({ message: 'Invalid vehicle.' });
  try {
    const vehicle = await Vehicle.findById(req.params.vehicleId).populate({ path: 'customer', select: 'name email mobile' }).lean();
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    const [jobs, appointments] = await Promise.all([
      ServiceJob.find({ vehicle: vehicle._id }).sort({ updatedAt: -1 }).limit(100)
        .populate({ path: 'technician', select: 'name' }).populate({ path: 'appointment', select: 'serviceType preferredDate' }).lean(),
      Appointment.find({ vehicle: vehicle._id }).sort({ preferredDate: -1, preferredTime: -1 }).limit(50)
        .populate({ path: 'assignedTechnician', select: 'name' }).lean(),
    ]);
    const invoices = jobs.length ? await Invoice.find({ serviceJob: { $in: jobs.map(job => job._id) }, customer: vehicle.customer?._id, paymentStatus: { $nin: ['Draft', 'Cancelled'] } })
      .sort({ createdAt: -1 }).populate({ path: 'serviceJob', select: 'serviceNumber' }).lean() : [];
    const mapJob = job => ({
      id: String(job._id), reference: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`,
      status: job.status, serviceType: job.appointment?.serviceType || 'Service repair', technician: job.technician?.name || 'Unassigned',
      openedAt: job.createdAt, updatedAt: job.updatedAt,
      completedAt: job.timeline?.slice().reverse().find(event => event.status === 'Ready')?.timestamp || job.updatedAt,
      timeline: (job.timeline || []).map(event => ({ status: event.status || 'Workshop update', notes: event.notes || '', timestamp: event.timestamp || null })),
    });
    res.set('Cache-Control', 'private, no-store').json({
      vehicle: { id: String(vehicle._id), registrationNumber: vehicle.registrationNumber, make: vehicle.make, model: vehicle.model, year: vehicle.year || null, fuelType: vehicle.fuelType || '', mileage: vehicle.mileage ?? null, vinNumber: vehicle.vinNumber || '', imageUrl: vehicle.imageUrl || '', createdAt: vehicle.createdAt },
      customer: vehicle.customer ? { id: String(vehicle.customer._id), name: vehicle.customer.name, email: vehicle.customer.email, mobile: vehicle.customer.mobile || '' } : null,
      currentJobs: jobs.filter(job => CURRENT_JOB_STATUSES.includes(job.status)).map(mapJob),
      previousJobs: jobs.filter(job => !CURRENT_JOB_STATUSES.includes(job.status)).map(mapJob),
      appointments: appointments.map(appointment => ({ id: String(appointment._id), reference: appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`, serviceType: appointment.serviceType, preferredDate: appointment.preferredDate, preferredTime: appointment.preferredTime, status: appointment.status, technician: appointment.assignedTechnician?.name || 'Unassigned' })),
      invoices: invoices.map(invoice => ({ id: String(invoice._id), invoiceNumber: invoice.invoiceNumber, serviceNumber: invoice.serviceJob?.serviceNumber || '—', totalAmount: invoice.totalAmount, amountPaid: invoice.amountPaid || 0, amountDue: Math.max(0, Math.round((invoice.totalAmount - (invoice.amountPaid || 0)) * 100) / 100), paymentStatus: invoice.paymentStatus, createdAt: invoice.createdAt })),
    });
  } catch { res.status(503).json({ message: 'Unable to load vehicle details. Please try again.' }); }
}

export async function createAdminVehicle(req, res) {
  const { data, error } = parseVehicle(req.body);
  if (error) return res.status(400).json({ message: error });
  try {
    const customer = await findCustomer(req.body?.customerId);
    if (!customer) return res.status(400).json({ message: 'Select an active customer for this vehicle.' });
    const expression = `^${escapeRegex(data.registrationNumber)}$`;
    if (await Vehicle.exists({ registrationNumber: { $regex: expression, $options: 'i' } })) return res.status(409).json({ message: 'That registration number is already registered.' });
    // Persist vehicle data as a new record in MongoDB; subsequent code uses the stored result.
    const vehicle = await Vehicle.create({ ...data, customer: customer._id });
    res.status(201).set('Cache-Control', 'private, no-store').json({ vehicle: { id: String(vehicle._id), registrationNumber: vehicle.registrationNumber, make: vehicle.make, model: vehicle.model }, customer: { id: String(customer._id), name: customer.name } });
  } catch (createError) {
    if (createError.code === 11000) return res.status(409).json({ message: 'That registration number is already registered.' });
    if (createError.name === 'ValidationError') return res.status(400).json({ message: 'Check the vehicle details and try again.' });
    res.status(503).json({ message: 'Unable to add this vehicle. Please try again.' });
  }
}

export async function updateAdminVehicle(req, res) {
  if (!mongoose.isValidObjectId(req.params.vehicleId)) return res.status(400).json({ message: 'Invalid vehicle.' });
  const { data, error } = parseVehicle(req.body);
  if (error) return res.status(400).json({ message: error });
  try {
    const vehicle = await Vehicle.findById(req.params.vehicleId);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    if (req.body?.customerId !== undefined && String(req.body.customerId) !== String(vehicle.customer)) {
      const customer = await findCustomer(req.body.customerId);
      if (!customer) return res.status(400).json({ message: 'Select an active customer for this vehicle.' });
      const jobIds = await ServiceJob.find({ vehicle: vehicle._id }).distinct('_id');
      const [hasAppointments, hasInvoices] = await Promise.all([
        Appointment.exists({ vehicle: vehicle._id }), Invoice.exists({ serviceJob: { $in: jobIds } }),
      ]);
      if (jobIds.length || hasAppointments || hasInvoices) return res.status(409).json({ message: 'Vehicle ownership cannot be changed after appointments or service history exist.' });
      vehicle.customer = customer._id;
    }
    const expression = `^${escapeRegex(data.registrationNumber)}$`;
    if (await Vehicle.exists({ _id: { $ne: vehicle._id }, registrationNumber: { $regex: expression, $options: 'i' } })) return res.status(409).json({ message: 'That registration number is already registered.' });
    Object.assign(vehicle, data);
    // Persist the changes made to vehicle above; document validation and registered save hooks run here.
    await vehicle.save();
    res.set('Cache-Control', 'private, no-store').json({ vehicle: { id: String(vehicle._id), registrationNumber: vehicle.registrationNumber, make: vehicle.make, model: vehicle.model } });
  } catch (updateError) {
    if (updateError.code === 11000) return res.status(409).json({ message: 'That registration number is already registered.' });
    if (updateError.name === 'ValidationError') return res.status(400).json({ message: 'Check the vehicle details and try again.' });
    res.status(503).json({ message: 'Unable to update vehicle details.' });
  }
}
