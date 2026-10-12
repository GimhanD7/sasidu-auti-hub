// Create reusable CRUD demo records only in an explicitly named development database.
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import Appointment from '../models/Appointment.js';
import ServiceJob from '../models/ServiceJob.js';
import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import ServiceType from '../models/ServiceType.js';

const uri = process.env.MONGO_URI;
const databaseName = uri ? new URL(uri).pathname.replace(/^\//, '').split('?')[0] : '';
if (process.env.SEED_DEMO_DATA !== 'true' || !uri || !/(dev|demo|test)/i.test(databaseName)) {
  console.error('Refusing to seed. Set SEED_DEMO_DATA=true and MONGO_URI to a database named with dev, demo, or test.');
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(uri);
    const password = await bcrypt.hash(process.env.DEMO_SEED_PASSWORD || 'DemoOnly!2026', 12);
    const [customer, technician] = await Promise.all([
      User.findOneAndUpdate({ email: 'demo.customer@example.test' }, { $setOnInsert: { name: 'Demo Customer', email: 'demo.customer@example.test', mobile: '0770000101', password, role: 'Customer' } }, { upsert: true, new: true, setDefaultsOnInsert: true }),
      User.findOneAndUpdate({ email: 'demo.technician@example.test' }, { $setOnInsert: { name: 'Demo Technician', email: 'demo.technician@example.test', mobile: '0770000102', password, role: 'Technician', technicianSpecialization: 'General Repair' } }, { upsert: true, new: true, setDefaultsOnInsert: true }),
    ]);
    const service = await ServiceType.findOneAndUpdate({ name: 'Demo General Repair' }, { $setOnInsert: { name: 'Demo General Repair', issueType: 'Other', defaultDurationMinutes: 120, estimatedCost: 15000, requiredSkill: 'General Repair', isActive: true } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const vehicle = await Vehicle.findOneAndUpdate({ registrationNumber: 'DEMO-001' }, { $setOnInsert: { customer: customer._id, registrationNumber: 'DEMO-001', make: 'Toyota', model: 'Aqua', year: 2018, fuelType: 'Hybrid', mileage: 65000 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const bookingDate = new Date();
    bookingDate.setUTCDate(bookingDate.getUTCDate() + 2);
    bookingDate.setUTCHours(0, 0, 0, 0);
    const finishDate = new Date(bookingDate);
    finishDate.setUTCDate(finishDate.getUTCDate() + 1);
    const appointment = await Appointment.findOneAndUpdate(
      { appointmentNumber: 'APT-DEMO-001' },
      { $setOnInsert: { appointmentNumber: 'APT-DEMO-001', customer: customer._id, vehicle: vehicle._id, serviceType: service.name, issueType: 'Other', preferredDate: bookingDate, preferredTime: '09:00', bookingSlotKey: `${bookingDate.toISOString().slice(0, 10)}|09:00`, problemDescription: 'Demo: unusual vibration during braking.', status: 'Pending', expectedFinishDate: finishDate, estimatedCost: 15000 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const jobDate = new Date();
    const job = await ServiceJob.findOneAndUpdate(
      { serviceNumber: 'JOB-DEMO-001' },
      { $setOnInsert: { serviceNumber: 'JOB-DEMO-001', appointment: appointment._id, customer: customer._id, vehicle: vehicle._id, technician: technician._id, status: 'Ready', customerComplaint: 'Demo: unusual vibration during braking.', issueType: 'Other', estimatedCost: 15000, finalReport: { notes: 'Demo completed repair record.', workDone: ['Inspected brake pads', 'Replaced front brake pads', 'Road tested vehicle'], tasksVerified: true, partsVerified: true, labourVerified: true, technician: technician._id, completedAt: jobDate }, replacedParts: [{ name: 'Front brake pad set', partNumber: 'DEMO-BP01', quantity: 1, unitCost: 6500, replacedAt: jobDate }], labourEntries: [{ description: 'Brake inspection and replacement', labourType: 'Repair', minutes: 90, ratePerHour: 3000, technician: technician._id, recordedAt: jobDate }], timeline: [{ status: 'Ready', timestamp: jobDate, notes: 'Demo job ready for invoicing.', actor: technician._id }] } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const invoice = await Invoice.findOneAndUpdate(
      { invoiceNumber: 'INV-DEMO-001' },
      { $setOnInsert: { serviceJob: job._id, customer: customer._id, invoiceNumber: 'INV-DEMO-001', parts: [{ name: 'Front brake pad set', partNumber: 'DEMO-BP01', quantity: 1, unitPrice: 6500, total: 6500 }], labourItems: [{ description: 'Brake inspection and replacement', hours: 1.5, rate: 3000, total: 4500 }], partsCost: 6500, labourCost: 4500, adminChargeDescription: 'Workshop supplies', adminChargeAmount: 500, tax: 0, discount: 0, totalAmount: 11500, paymentStatus: 'Pending' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (!job.billingInvoice || String(job.billingInvoice) !== String(invoice._id)) {
      job.billingInvoice = invoice._id;
      await job.save();
    }
    await Payment.findOneAndUpdate(
      { invoice: invoice._id, transactionReference: 'DEMO-TRANSFER-001' },
      { $setOnInsert: { invoice: invoice._id, customer: customer._id, amount: 5000, method: 'Bank Transfer', transactionReference: 'DEMO-TRANSFER-001', status: 'Pending Verification' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log('Demo CRUD data is ready: customer, technician, service type, vehicle, appointment, completed job, invoice, and payment submission.');
    console.log(`Demo accounts use password: ${process.env.DEMO_SEED_PASSWORD || 'DemoOnly!2026'}`);
  } catch (error) {
    console.error(`Demo seed failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
