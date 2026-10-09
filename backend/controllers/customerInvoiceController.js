// Return invoices belonging to the signed-in customer, excluding drafts that have not been issued.
import Invoice from '../models/Invoice.js';

export async function listCustomerInvoices(req, res) {
  try {
    const invoices = await Invoice.find({ customer: req.user._id, paymentStatus: { $nin: ['Draft', 'Cancelled'] } })
      .sort({ createdAt: -1 })
      .populate({
        path: 'serviceJob', select: 'serviceNumber vehicle appointment',
        populate: [
          { path: 'vehicle', select: 'make model year registrationNumber' },
          { path: 'appointment', select: 'serviceType' },
        ],
      }).lean();
    res.set('Cache-Control', 'private, no-store').json(invoices.map(invoice => {
      const job = invoice.serviceJob;
      return {
        id: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        serviceNumber: job?.serviceNumber || (job?._id ? `JOB-${String(job._id).slice(-8).toUpperCase()}` : 'Service job unavailable'),
        serviceJobId: job?._id ? String(job._id) : null,
        serviceType: job?.appointment?.serviceType || 'Service repair',
        vehicle: job?.vehicle ? {
          id: String(job.vehicle._id), make: job.vehicle.make, model: job.vehicle.model,
          year: job.vehicle.year || null, registrationNumber: job.vehicle.registrationNumber,
        } : null,
        parts: (invoice.parts || []).map(part => ({ name: part.name || 'Part', partNumber: part.partNumber || '', quantity: part.quantity ?? null, unitPrice: part.unitPrice ?? null, total: part.total ?? (part.unitPrice != null && part.quantity != null ? part.unitPrice * part.quantity : null) })),
        labourItems: (invoice.labourItems || []).map(item => ({ description: item.description || 'Labour', hours: item.hours ?? null, rate: item.rate ?? null, total: item.total ?? (item.hours != null && item.rate != null ? item.hours * item.rate : null) })),
        partsCost: invoice.partsCost ?? 0,
        labourCost: invoice.labourCost ?? 0,
        additionalRepairsCost: invoice.additionalRepairsCost ?? 0,
        tax: invoice.tax ?? 0,
        discount: invoice.discount ?? 0,
        totalAmount: invoice.totalAmount,
        amountPaid: invoice.amountPaid ?? 0,
        amountDue: Math.max(0, Number(invoice.totalAmount) - Number(invoice.amountPaid || 0)),
        paymentStatus: invoice.paymentStatus || 'Pending',
        paymentDate: invoice.paymentDate || null,
        paymentMethod: invoice.paymentMethod || null,
        issuedAt: invoice.createdAt,
      };
    }));
  } catch {
    res.status(503).json({ message: 'Unable to load your invoices. Please try again.' });
  }
}
