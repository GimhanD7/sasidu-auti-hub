import Invoice from '../models/Invoice.js';
import ServiceJob from '../models/ServiceJob.js';
import Vehicle from '../models/Vehicle.js';

const ACTIVE_STATUSES = ['Inspecting', 'In Progress', 'Waiting for Approval', 'Final Test'];

export async function listCustomerServiceHistory(req, res) {
  try {
    const [jobs, vehicles] = await Promise.all([
      ServiceJob.find({ customer: req.user._id, status: { $nin: [...ACTIVE_STATUSES, 'Cancelled'] } })
        .sort({ updatedAt: -1 })
        .populate({ path: 'vehicle', select: 'make model year registrationNumber' })
        .populate({ path: 'technician', select: 'name' })
        .populate({ path: 'appointment', select: 'serviceType' })
        .lean(),
      Vehicle.find({ customer: req.user._id }).select('make model year registrationNumber').sort({ createdAt: -1 }).lean(),
    ]);
    const jobIds = jobs.map(job => job._id);
    const invoices = jobIds.length ? await Invoice.find({ customer: req.user._id, serviceJob: { $in: jobIds }, paymentStatus: { $nin: ['Draft', 'Cancelled'] } })
      .select('serviceJob invoiceNumber partsCost labourCost additionalRepairsCost tax discount totalAmount paymentStatus paymentDate createdAt')
      .sort({ createdAt: -1 }).lean() : [];
    const invoiceByJob = new Map();
    for (const invoice of invoices) if (!invoiceByJob.has(String(invoice.serviceJob))) invoiceByJob.set(String(invoice.serviceJob), invoice);

    const records = jobs.map(job => {
      const readyEvent = (job.timeline || []).slice().reverse().find(event => event.status === 'Ready');
      const invoice = invoiceByJob.get(String(job._id));
      return {
        id: String(job._id),
        serviceNumber: job.serviceNumber || `JOB-${String(job._id).slice(-8).toUpperCase()}`,
        status: job.status,
        serviceType: job.appointment?.serviceType || 'Service repair',
        serviceDate: readyEvent?.timestamp || job.updatedAt || job.createdAt,
        vehicle: job.vehicle ? { id: String(job.vehicle._id), make: job.vehicle.make, model: job.vehicle.model, year: job.vehicle.year || null, registrationNumber: job.vehicle.registrationNumber } : null,
        technician: job.technician?.name || null,
        mileageAtService: job.mileageAtService ?? null,
        completedWork: (job.tasks || []).filter(task => task.status === 'Complete').map(task => ({ title: task.title, notes: task.notes || '', completedAt: task.completedAt || null })),
        replacedParts: (job.replacedParts || []).map(part => ({ name: part.name || 'Part', partNumber: part.partNumber || '', quantity: part.quantity ?? null, unitCost: part.unitCost ?? null, replacedAt: part.replacedAt || null })),
        timeline: (job.timeline || []).map(event => ({ status: event.status || 'Workshop update', notes: event.notes || '', timestamp: event.timestamp || null })),
        invoice: invoice ? {
          invoiceNumber: invoice.invoiceNumber,
          partsCost: invoice.partsCost,
          labourCost: invoice.labourCost,
          additionalRepairsCost: invoice.additionalRepairsCost,
          tax: invoice.tax,
          discount: invoice.discount,
          totalAmount: invoice.totalAmount,
          paymentStatus: invoice.paymentStatus,
          paymentDate: invoice.paymentDate || null,
        } : null,
      };
    });
    res.set('Cache-Control', 'private, no-store').json({
      vehicles: vehicles.map(vehicle => ({ id: String(vehicle._id), make: vehicle.make, model: vehicle.model, year: vehicle.year || null, registrationNumber: vehicle.registrationNumber })),
      records,
    });
  } catch {
    res.status(503).json({ message: 'Unable to load your service history. Please try again.' });
  }
}
