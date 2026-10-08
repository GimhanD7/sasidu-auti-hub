import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import mongoose from 'mongoose';
import ServiceJob from '../models/ServiceJob.js';
import User from '../models/User.js';

const DAY = 24 * 60 * 60 * 1000;
const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;
const utcDay = value => { const result = new Date(value); result.setUTCHours(0, 0, 0, 0); return result; };
const dateKey = date => date.toISOString().slice(0, 10);
const rangeSum = async (start, end) => {
  const rows = await Payment.aggregate([
    { $match: { status: 'Completed', reviewedAt: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return { total: roundMoney(rows[0]?.total), count: Number(rows[0]?.count) || 0 };
};

export function selectRange(period, from, to, now = new Date()) {
  let start;
  let end;
  if (period === 'custom') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
    start = new Date(`${from}T00:00:00.000Z`);
    const inclusiveEnd = new Date(`${to}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(inclusiveEnd.getTime()) || dateKey(start) !== from || dateKey(inclusiveEnd) !== to || start > inclusiveEnd) return null;
    end = new Date(inclusiveEnd.getTime() + DAY);
    if ((end - start) / DAY > 3660) return null;
  } else {
    const today = utcDay(now);
    if (period === 'daily') { start = today; end = new Date(start.getTime() + DAY); }
    else if (period === 'weekly') {
      start = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY);
      end = new Date(start.getTime() + 7 * DAY);
    } else if (period === 'monthly') {
      start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    } else if (period === 'annual') {
      start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      end = new Date(Date.UTC(today.getUTCFullYear() + 1, 0, 1));
    } else return null;
  }
  const duration = end.getTime() - start.getTime();
  return { start, end, previousStart: new Date(start.getTime() - duration), previousEnd: start, duration };
}

const serviceCategories = ['Full Service', 'Oil Changes', 'Brake Repairs', 'Engine Repairs', 'Electrical Repairs'];

export async function getFinanceRevenueByService(req, res) {
  const period = req.query.period || 'monthly';
  if (!['daily', 'weekly', 'monthly', 'annual', 'custom'].includes(period)) return res.status(400).json({ message: 'Choose a supported report period.' });
  const range = selectRange(period, req.query.from, req.query.to);
  if (!range) return res.status(400).json({ message: 'Enter a valid date range of no more than ten years.' });
  try {
    const rows = await Payment.aggregate([
      { $match: { status: 'Completed', reviewedAt: { $gte: range.start, $lt: range.end } } },
      { $lookup: { from: 'invoices', localField: 'invoice', foreignField: '_id', as: 'invoice' } },
      { $unwind: '$invoice' },
      { $lookup: { from: 'servicejobs', localField: 'invoice.serviceJob', foreignField: '_id', as: 'job' } },
      { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'appointments', localField: 'job.appointment', foreignField: '_id', as: 'appointment' } },
      { $unwind: { path: '$appointment', preserveNullAndEmptyArrays: true } },
      { $set: { serviceLabel: { $toLower: { $concat: [{ $ifNull: ['$appointment.serviceType', ''] }, ' ', { $ifNull: ['$job.diagnosticReport.issueCategory', ''] }] } } } },
      { $set: { category: { $switch: { branches: [
        { case: { $regexMatch: { input: '$serviceLabel', regex: 'full[ -]?service|general service' } }, then: 'Full Service' },
        { case: { $regexMatch: { input: '$serviceLabel', regex: 'oil|lubricat' } }, then: 'Oil Changes' },
        { case: { $regexMatch: { input: '$serviceLabel', regex: 'brake' } }, then: 'Brake Repairs' },
        { case: { $regexMatch: { input: '$serviceLabel', regex: 'engine' } }, then: 'Engine Repairs' },
        { case: { $regexMatch: { input: '$serviceLabel', regex: 'electri' } }, then: 'Electrical Repairs' },
      ], default: 'Other Services' } } } },
      { $group: { _id: '$category', revenue: { $sum: '$amount' }, transactions: { $sum: 1 } } },
    ]);
    const grouped = new Map(rows.map(row => [row._id, { revenue: roundMoney(row.revenue), transactions: Number(row.transactions) || 0 }]));
    const services = [...serviceCategories, 'Other Services'].map(name => ({ name, ...(grouped.get(name) || { revenue: 0, transactions: 0 }) }));
    const highestEarning = services.filter(service => service.revenue > 0).sort((a, b) => b.revenue - a.revenue)[0]?.name || null;
    res.set('Cache-Control', 'private, no-store').json({ period, range: { from: range.start.toISOString(), to: new Date(range.end.getTime() - 1).toISOString() }, services, highestEarning });
  } catch {
    res.status(503).json({ message: 'Unable to generate the revenue by service report.' });
  }
}

export async function getFinancePartsReport(req, res) {
  const period = req.query.period || 'monthly';
  if (!['daily', 'weekly', 'monthly', 'annual', 'custom'].includes(period)) return res.status(400).json({ message: 'Choose a supported report period.' });
  const range = selectRange(period, req.query.from, req.query.to);
  if (!range) return res.status(400).json({ message: 'Enter a valid date range of no more than ten years.' });
  try {
    const rows = await Invoice.aggregate([
      { $match: { paymentStatus: { $nin: ['Draft', 'Cancelled'] }, createdAt: { $gte: range.start, $lt: range.end }, 'parts.0': { $exists: true } } },
      { $unwind: '$parts' },
      { $lookup: { from: 'servicejobs', localField: 'serviceJob', foreignField: '_id', as: 'job' } },
      { $unwind: { path: '$job', preserveNullAndEmptyArrays: true } },
      { $set: { costEntry: { $arrayElemAt: [{ $filter: { input: { $ifNull: ['$job.replacedParts', []] }, as: 'usedPart', cond: { $or: [
        { $and: [{ $ne: [{ $ifNull: ['$parts.partNumber', ''] }, ''] }, { $eq: ['$$usedPart.partNumber', '$parts.partNumber'] }] },
        { $eq: ['$$usedPart.name', '$parts.name'] },
      ] } } }, 0] } } },
      { $set: { partCost: { $ifNull: ['$costEntry.totalCost', { $multiply: [{ $ifNull: ['$costEntry.unitCost', 0] }, { $ifNull: ['$parts.quantity', 0] }] }] } } },
      { $group: { _id: { name: '$parts.name', partNumber: { $ifNull: ['$parts.partNumber', ''] } }, quantity: { $sum: { $ifNull: ['$parts.quantity', 0] } }, revenue: { $sum: { $ifNull: ['$parts.total', { $multiply: [{ $ifNull: ['$parts.quantity', 0] }, { $ifNull: ['$parts.unitPrice', 0] }] }] } }, cost: { $sum: '$partCost' }, invoices: { $sum: 1 } } },
      { $sort: { quantity: -1, revenue: -1, '_id.name': 1 } },
    ]);
    const parts = rows.map(row => ({ name: row._id?.name || 'Unnamed part', partNumber: row._id?.partNumber || '', quantity: Number(row.quantity) || 0, revenue: roundMoney(row.revenue), cost: roundMoney(row.cost), invoices: Number(row.invoices) || 0 }));
    res.set('Cache-Control', 'private, no-store').json({ period, range: { from: range.start.toISOString(), to: new Date(range.end.getTime() - 1).toISOString() }, summary: { partTypes: parts.length, quantity: parts.reduce((sum, part) => sum + part.quantity, 0), revenue: roundMoney(parts.reduce((sum, part) => sum + part.revenue, 0)), cost: roundMoney(parts.reduce((sum, part) => sum + part.cost, 0)), mostUsedPart: parts[0]?.name || null }, parts });
  } catch {
    res.status(503).json({ message: 'Unable to generate the parts revenue and cost report.' });
  }
}

export async function getFinanceTechnicianReport(req, res) {
  const period = req.query.period || 'monthly';
  if (!['daily', 'weekly', 'monthly', 'annual', 'custom'].includes(period)) return res.status(400).json({ message: 'Choose a supported report period.' });
  const range = selectRange(period, req.query.from, req.query.to);
  if (!range) return res.status(400).json({ message: 'Enter a valid date range of no more than ten years.' });
  const technicianId = req.query.technicianId;
  if (technicianId && !mongoose.isValidObjectId(technicianId)) return res.status(400).json({ message: 'Choose a valid technician.' });
  try {
    const match = { status: 'Ready', 'finalReport.completedAt': { $gte: range.start, $lt: range.end } };
    if (technicianId) match.$expr = { $eq: [{ $ifNull: ['$finalReport.technician', '$technician'] }, new mongoose.Types.ObjectId(technicianId)] };
    const [technicians, rows] = await Promise.all([
      User.find({ role: 'Technician', isActive: { $ne: false } }).select('_id name').sort({ name: 1 }).lean(),
      ServiceJob.aggregate([
        { $match: match },
        { $set: { reportTechnician: { $ifNull: ['$finalReport.technician', '$technician'] }, startedAtForReport: { $ifNull: ['$inspection.startedAt', '$createdAt'] } } },
        { $lookup: { from: 'users', localField: 'reportTechnician', foreignField: '_id', as: 'technicianInfo' } },
        { $unwind: { path: '$technicianInfo', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'invoices', let: { jobId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$serviceJob', '$$jobId'] }, { $nin: ['$paymentStatus', ['Draft', 'Cancelled']] }] } } }, { $project: { totalAmount: 1 } }, { $limit: 1 }], as: 'reportInvoice' } },
        { $set: { invoiceRevenue: { $ifNull: [{ $arrayElemAt: ['$reportInvoice.totalAmount', 0] }, 0] }, completionHours: { $divide: [{ $subtract: ['$finalReport.completedAt', '$startedAtForReport'] }, 3600000] }, recordedLabourMinutes: { $reduce: { input: { $ifNull: ['$labourEntries', []] }, initialValue: 0, in: { $add: ['$$value', { $ifNull: ['$$this.minutes', 0] }] } } } } },
        { $group: { _id: '$reportTechnician', technicianName: { $first: '$technicianInfo.name' }, jobsCompleted: { $sum: 1 }, labourMinutes: { $sum: '$recordedLabourMinutes' }, revenue: { $sum: '$invoiceRevenue' }, averageCompletionHours: { $avg: '$completionHours' } } },
        { $sort: { revenue: -1, jobsCompleted: -1, technicianName: 1 } },
      ]),
    ]);
    const byId = new Map(rows.map(row => [String(row._id), row]));
    const reportRows = (technicianId ? technicians.filter(person => String(person._id) === technicianId) : technicians).map(person => {
      const row = byId.get(String(person._id));
      return { technicianId: String(person._id), technicianName: person.name, jobsCompleted: Number(row?.jobsCompleted) || 0, labourHours: Math.round((Number(row?.labourMinutes) || 0) / 60 * 100) / 100, revenue: roundMoney(row?.revenue), averageCompletionHours: Math.round((Number(row?.averageCompletionHours) || 0) * 100) / 100 };
    }).sort((a, b) => b.revenue - a.revenue || b.jobsCompleted - a.jobsCompleted || a.technicianName.localeCompare(b.technicianName));
    res.set('Cache-Control', 'private, no-store').json({ period, range: { from: range.start.toISOString(), to: new Date(range.end.getTime() - 1).toISOString() }, technicians: technicians.map(person => ({ id: String(person._id), name: person.name })), summary: { jobsCompleted: reportRows.reduce((sum, row) => sum + row.jobsCompleted, 0), labourHours: Math.round(reportRows.reduce((sum, row) => sum + row.labourHours, 0) * 100) / 100, revenue: roundMoney(reportRows.reduce((sum, row) => sum + row.revenue, 0)) }, rows: reportRows });
  } catch {
    res.status(503).json({ message: 'Unable to generate the technician productivity report.' });
  }
}

function makeBuckets(period, start, end, duration) {
  const buckets = [];
  if (period === 'daily') {
    for (let hour = 0; hour < 24; hour += 1) {
      const date = new Date(start.getTime() + hour * 60 * 60 * 1000);
      buckets.push({ key: `${dateKey(date)}T${String(hour).padStart(2, '0')}`, label: `${String(hour).padStart(2, '0')}:00` });
    }
  } else if (period === 'annual' || (period === 'custom' && duration > 31 * DAY)) {
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor < end) {
      buckets.push({ key: cursor.toISOString().slice(0, 7), label: new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(cursor) });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  } else {
    for (let cursor = new Date(start); cursor < end; cursor = new Date(cursor.getTime() + DAY)) {
      buckets.push({ key: dateKey(cursor), label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(cursor) });
    }
  }
  return buckets;
}

export async function getFinanceRevenueReport(req, res) {
  const period = req.query.period || 'monthly';
  if (!['daily', 'weekly', 'monthly', 'annual', 'custom'].includes(period)) return res.status(400).json({ message: 'Choose a supported report period.' });
  const range = selectRange(period, req.query.from, req.query.to);
  if (!range) return res.status(400).json({ message: period === 'custom' ? 'Enter a valid date range of no more than ten years.' : 'Choose a supported report period.' });
  try {
    const format = period === 'daily' ? '%Y-%m-%dT%H' : period === 'annual' || (period === 'custom' && range.duration > 31 * DAY) ? '%Y-%m' : '%Y-%m-%d';
    const [current, previous, trendRows, invoiceRows] = await Promise.all([
      rangeSum(range.start, range.end),
      rangeSum(range.previousStart, range.previousEnd),
      Payment.aggregate([
        { $match: { status: 'Completed', reviewedAt: { $gte: range.start, $lt: range.end } } },
        { $group: { _id: { $dateToString: { format, date: '$reviewedAt', timezone: 'UTC' } }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } },
      ]),
      Invoice.aggregate([
        { $match: { paymentStatus: { $nin: ['Draft', 'Cancelled'] }, createdAt: { $gte: range.start, $lt: range.end } } },
        { $group: { _id: null, averageInvoiceValue: { $avg: '$totalAmount' }, invoiceCount: { $sum: 1 } } },
      ]),
    ]);
    const buckets = makeBuckets(period, range.start, range.end, range.duration);
    const values = new Map(trendRows.map(row => [row._id, roundMoney(row.total)]));
    const trend = buckets.map(bucket => ({ ...bucket, revenue: values.get(bucket.key) || 0 }));
    const changeAmount = roundMoney(current.total - previous.total);
    const changePercent = previous.total ? roundMoney(changeAmount / previous.total * 100) : null;
    res.set('Cache-Control', 'private, no-store').json({
      period,
      range: { from: range.start.toISOString(), to: new Date(range.end.getTime() - 1).toISOString() },
      comparisonRange: { from: range.previousStart.toISOString(), to: new Date(range.previousEnd.getTime() - 1).toISOString() },
      summary: {
        totalRevenue: current.total, transactionCount: current.count,
        previousRevenue: previous.total, revenueChange: changeAmount, revenueChangePercent: changePercent,
        averageInvoiceValue: roundMoney(invoiceRows[0]?.averageInvoiceValue), invoiceCount: Number(invoiceRows[0]?.invoiceCount) || 0,
      },
      trend,
    });
  } catch {
    res.status(503).json({ message: 'Unable to generate this revenue report.' });
  }
}
