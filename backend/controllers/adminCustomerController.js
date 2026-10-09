// Customer administration: search profiles, assemble related service records, create or edit accounts, and change account availability.
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Invoice from '../models/Invoice.js';
import ServiceJob from '../models/ServiceJob.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { hashToken, newToken } from '../utils/session.js';
import { passwordResetEmail } from '../services/passwordResetEmail.js';

// Roles recognized as customer accounts in the database
const CUSTOMER_ROLES = ['Customer', 'user'];

// Statuses representing active workshop service jobs
const ACTIVE_JOB_STATUSES = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test'];

// Helper function to escape special regex characters for safe MongoDB text searches
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Validates and normalizes customer input data (Name, Email, Mobile).
 * @param {Object} body - Request body containing customer parameters
 * @returns {Object} { data: { name, email, mobile } } if valid, or { error: string } if invalid
 */
function customerInput(body = {}) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const mobile = typeof body.mobile === 'string' ? body.mobile.replace(/[\s()-]/g, '') : '';

  if (name.length < 2 || name.length > 100) return { error: 'Name must contain 2 to 100 characters.' };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' };
  if (!/^\+?\d{10,15}$/.test(mobile)) return { error: 'Enter a valid mobile number with 10 to 15 digits.' };

  return { data: { name, email, mobile } };
}

/**
 * List all customer accounts with pagination and optional search filter.
 * GET /api/admin/customers?search=...&page=...
 */
export async function listAdminCustomers(req, res) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
  const limit = 50;

  // Build filter for customer accounts
  const filter = { role: { $in: CUSTOMER_ROLES } };

  // If a search query is provided, perform case-insensitive regex search on name, email, or mobile
  if (search) {
    const expression = escapeRegex(search);
    filter.$or = [
      { name: { $regex: expression, $options: 'i' } },
      { email: { $regex: expression, $options: 'i' } },
      { mobile: { $regex: expression, $options: 'i' } }
    ];
  }

  try {
    // Execute query and count total matching records concurrently
    const [customers, total] = await Promise.all([
      User.find(filter)
        .select('name email mobile isActive createdAt')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Return paginated list of customers
    res.set('Cache-Control', 'private, no-store').json({
      customers: customers.map(customer => ({
        id: String(customer._id),
        name: customer.name,
        email: customer.email,
        mobile: customer.mobile || '',
        isActive: customer.isActive !== false,
        createdAt: customer.createdAt
      })),
      page,
      pages: Math.ceil(total / limit),
      total
    });
  } catch {
    res.status(503).json({ message: 'Unable to load customers. Please try again.' });
  }
}

/**
 * Fetch detailed profile and full historical summary for a specific customer.
 * Includes registered vehicles, appointments, active jobs, service history, and invoices.
 * GET /api/admin/customers/:customerId
 */
export async function getAdminCustomer(req, res) {
  // Validate ObjectId parameter
  if (!mongoose.isValidObjectId(req.params.customerId)) return res.status(400).json({ message: 'Invalid customer.' });

  try {
    // 1. Fetch customer user record
    const customer = await User.findOne({ _id: req.params.customerId, role: { $in: CUSTOMER_ROLES } })
      .select('name email mobile isActive createdAt')
      .lean();

    if (!customer) return res.status(404).json({ message: 'Customer not found.' });

    // 2. Fetch associated records in parallel (vehicles, appointments, service jobs, invoices)
    const [vehicles, appointments, jobs, invoices] = await Promise.all([
      Vehicle.find({ customer: customer._id }).sort({ createdAt: -1 }).lean(),
      Appointment.find({ customer: customer._id })
        .sort({ preferredDate: -1, preferredTime: -1 })
        .limit(50)
        .populate({ path: 'vehicle', select: 'make model year registrationNumber' })
        .populate({ path: 'assignedTechnician', select: 'name' })
        .lean(),
      ServiceJob.find({ customer: customer._id })
        .sort({ updatedAt: -1 })
        .limit(100)
        .populate({ path: 'vehicle', select: 'make model year registrationNumber' })
        .populate({ path: 'technician', select: 'name' })
        .populate({ path: 'appointment', select: 'serviceType preferredDate' })
        .lean(),
      Invoice.find({ customer: customer._id, paymentStatus: { $nin: ['Draft', 'Cancelled'] } })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate({ path: 'serviceJob', select: 'serviceNumber vehicle' })
        .lean(),
    ]);

    // Separate active jobs and unpaid/outstanding invoices
    const outstanding = invoices.filter(invoice => ['Pending', 'Partially Paid', 'Overdue'].includes(invoice.paymentStatus));
    const activeJobs = jobs.filter(job => ACTIVE_JOB_STATUSES.includes(job.status));

    // Construct response payload with formatted records and summary statistics
    res.set('Cache-Control', 'private, no-store').json({
      customer: {
        id: String(customer._id),
        name: customer.name,
        email: customer.email,
        mobile: customer.mobile || '',
        isActive: customer.isActive !== false,
        createdAt: customer.createdAt
      },
      vehicles: vehicles.map(vehicle => ({
        id: String(vehicle._id),
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year || null,
        registrationNumber: vehicle.registrationNumber,
        vinNumber: vehicle.vinNumber || '',
        mileage: vehicle.mileage ?? null
      })),
      appointments: appointments.map(appointment => ({
        id: String(appointment._id),
        reference: appointment.appointmentNumber || `APT-${String(appointment._id).slice(-8).toUpperCase()}`,
        serviceType: appointment.serviceType,
        preferredDate: appointment.preferredDate,
        preferredTime: appointment.preferredTime,
        status: appointment.status,
        technician: appointment.assignedTechnician?.name || 'Unassigned',
        vehicle: appointment.vehicle ? `${appointment.vehicle.make} ${appointment.vehicle.model} (${appointment.vehicle.registrationNumber})` : 'Vehicle unavailable'
      })),
      currentJobs: activeJobs.map(job => ({
        id: String(job._id),
        reference: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`,
        status: job.status,
        vehicle: job.vehicle ? `${job.vehicle.make} ${job.vehicle.model} (${job.vehicle.registrationNumber})` : 'Vehicle unavailable',
        technician: job.technician?.name || 'Unassigned',
        serviceType: job.appointment?.serviceType || 'Service repair',
        updatedAt: job.updatedAt
      })),
      serviceHistory: jobs.filter(job => !ACTIVE_JOB_STATUSES.includes(job.status) && job.status !== 'Cancelled').map(job => ({
        id: String(job._id),
        reference: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`,
        status: job.status,
        vehicle: job.vehicle ? `${job.vehicle.make} ${job.vehicle.model} (${job.vehicle.registrationNumber})` : 'Vehicle unavailable',
        technician: job.technician?.name || 'Unassigned',
        serviceType: job.appointment?.serviceType || 'Service repair',
        completedAt: job.timeline?.slice().reverse().find(event => event.status === 'Ready')?.timestamp || job.updatedAt
      })),
      invoices: invoices.map(invoice => ({
        id: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        serviceNumber: invoice.serviceJob?.serviceNumber || '—',
        totalAmount: invoice.totalAmount,
        amountPaid: invoice.amountPaid || 0,
        amountDue: Math.max(0, Math.round((invoice.totalAmount - (invoice.amountPaid || 0)) * 100) / 100),
        paymentStatus: invoice.paymentStatus,
        createdAt: invoice.createdAt
      })),
      summary: {
        vehicles: vehicles.length,
        appointments: appointments.length,
        currentJobs: activeJobs.length,
        serviceHistory: jobs.filter(job => !ACTIVE_JOB_STATUSES.includes(job.status) && job.status !== 'Cancelled').length,
        outstandingInvoices: outstanding.length,
        outstandingAmount: Math.round(outstanding.reduce((total, invoice) => total + Math.max(0, invoice.totalAmount - (invoice.amountPaid || 0)), 0) * 100) / 100
      },
    });
  } catch {
    res.status(503).json({ message: 'Unable to load customer details. Please try again.' });
  }
}

/**
 * Create a new customer profile.
 * Hashes a default password and dispatches an account setup / password reset email if SMTP is configured.
 * POST /api/admin/customers
 */
export async function createAdminCustomer(req, res) {
  // 1. Validate customer input data
  const { data, error } = customerInput(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    // 2. Ensure email or mobile is not already registered
    if (await User.exists({ $or: [{ email: data.email }, { mobile: data.mobile }] })) {
      return res.status(409).json({ message: 'A user with this email or mobile already exists.' });
    }

    // 3. Hash default password and save the new Customer document
    const generatedPassword = '12345678';
    // Persist user data as a new record in MongoDB; subsequent code uses the stored result.
    const customer = await User.create({
      ...data,
      password: await bcrypt.hash(generatedPassword, 10),
      role: 'Customer'
    });

    // 4. Optionally dispatch an account setup email with password reset token if SMTP is configured
    let accountSetupEmailSent = false;
    if (passwordResetEmail.isConfigured()) {
      try {
        const token = newToken();
        // Apply the specified user database changes only to records matching this filter.
        await User.updateOne(
          { _id: customer._id },
          { $set: { resetTokenHash: hashToken(token), resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000) } }
        );
        await passwordResetEmail.send(customer.email, token);
        accountSetupEmailSent = true;
      } catch {
        /* Account creation succeeds even if email delivery fails or SMTP is unconfigured. */
      }
    }

    // 5. Return success response with created customer details
    res.status(201).set('Cache-Control', 'private, no-store').json({
      customer: {
        id: String(customer._id),
        name: customer.name,
        email: customer.email,
        mobile: customer.mobile,
        isActive: true
      },
      accountSetupEmailSent
    });
  } catch (createError) {
    if (createError.code === 11000) return res.status(409).json({ message: 'A user with this email or mobile already exists.' });
    if (createError.name === 'ValidationError') return res.status(400).json({ message: 'Check the customer details and try again.' });
    res.status(503).json({ message: 'Unable to add this customer. Please try again.' });
  }
}

/**
 * Update an existing customer profile details (Name, Email, Mobile).
 * PATCH /api/admin/customers/:customerId
 */
export async function updateAdminCustomer(req, res) {
  if (!mongoose.isValidObjectId(req.params.customerId)) return res.status(400).json({ message: 'Invalid customer.' });

  // 1. Validate updated input fields
  const { data, error } = customerInput(req.body);
  if (error) return res.status(400).json({ message: error });

  try {
    // 2. Find customer document
    const customer = await User.findOne({ _id: req.params.customerId, role: { $in: CUSTOMER_ROLES } });
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });

    // 3. Ensure updated email/mobile does not conflict with another existing user
    if (await User.exists({ _id: { $ne: customer._id }, $or: [{ email: data.email }, { mobile: data.mobile }] })) {
      return res.status(409).json({ message: 'Another user already has this email or mobile number.' });
    }

    // 4. Update customer properties and persist changes
    Object.assign(customer, data);
    // Persist the changes made to customer above; document validation and registered save hooks run here.
    await customer.save();

    // 5. Return updated customer record
    res.set('Cache-Control', 'private, no-store').json({
      customer: {
        id: String(customer._id),
        name: customer.name,
        email: customer.email,
        mobile: customer.mobile || '',
        isActive: customer.isActive !== false
      }
    });
  } catch (updateError) {
    if (updateError.code === 11000) return res.status(409).json({ message: 'Another user already has this email or mobile number.' });
    if (updateError.name === 'ValidationError') return res.status(400).json({ message: 'Check the customer details and try again.' });
    res.status(503).json({ message: 'Unable to update customer details.' });
  }
}

/**
 * Toggle customer account status (Reactivate or Suspend).
 * Increments `sessionVersion` to immediately invalidate all active JWT/cookie login sessions if suspended.
 * PATCH /api/admin/customers/:customerId/status
 */
export async function setAdminCustomerStatus(req, res) {
  if (!mongoose.isValidObjectId(req.params.customerId) || typeof req.body?.isActive !== 'boolean') {
    return res.status(400).json({ message: 'Select a customer and a valid account status.' });
  }

  try {
    // Update active status, increment sessionVersion to invalidate existing tokens, and clear reset tokens
    const customer = await User.findOneAndUpdate(
      { _id: req.params.customerId, role: { $in: CUSTOMER_ROLES } },
      {
        $set: { isActive: req.body.isActive },
        $inc: { sessionVersion: 1 },
        $unset: { resetTokenHash: '', resetTokenExpiresAt: '' }
      },
      { new: true }
    );

    if (!customer) return res.status(404).json({ message: 'Customer not found.' });

    res.json({
      message: customer.isActive ? 'Customer account reactivated.' : 'Customer account suspended.',
      isActive: customer.isActive
    });
  } catch {
    res.status(503).json({ message: 'Unable to update account status.' });
  }
}
