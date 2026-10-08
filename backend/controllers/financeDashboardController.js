import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';

const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;

export async function getFinanceDashboard(req, res) {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const chartStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const [todayRows, monthRows, chartRows, totalInvoices, paidInvoices, pendingInvoices, overdueInvoices, outstandingRows, payments] = await Promise.all([
      Payment.aggregate([{ $match: { status: 'Completed', reviewedAt: { $gte: startOfToday, $lt: startOfTomorrow } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Payment.aggregate([{ $match: { status: 'Completed', reviewedAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Payment.aggregate([
        { $match: { status: 'Completed', reviewedAt: { $gte: chartStart } } },
        { $group: { _id: { year: { $year: '$reviewedAt' }, month: { $month: '$reviewedAt' } }, total: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Invoice.countDocuments({ paymentStatus: { $nin: ['Draft', 'Cancelled'] } }),
      Invoice.countDocuments({ paymentStatus: 'Paid' }),
      Invoice.countDocuments({ paymentStatus: { $in: ['Pending', 'Partially Paid'] } }),
      Invoice.countDocuments({ paymentStatus: 'Overdue' }),
      Invoice.aggregate([
        { $match: { paymentStatus: { $in: ['Pending', 'Partially Paid', 'Overdue'] } } },
        { $project: { balance: { $max: [0, { $subtract: ['$totalAmount', { $ifNull: ['$amountPaid', 0] }] }] } } },
        { $group: { _id: null, total: { $sum: '$balance' } } },
      ]),
      Payment.find().sort({ createdAt: -1 }).limit(8)
        .populate({ path: 'customer', select: 'name email' })
        .populate({ path: 'invoice', select: 'invoiceNumber' }).lean(),
    ]);

    const revenueByMonth = Array.from({ length: 6 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const year = month.getFullYear();
      const monthNumber = month.getMonth() + 1;
      const entry = chartRows.find(row => row._id.year === year && row._id.month === monthNumber);
      return { year, month: monthNumber, label: new Intl.DateTimeFormat('en', { month: 'short' }).format(month), total: roundMoney(entry?.total) };
    });

    res.set('Cache-Control', 'private, no-store').json({
      summary: {
        todayRevenue: roundMoney(todayRows[0]?.total),
        monthlyRevenue: roundMoney(monthRows[0]?.total),
        totalInvoices,
        paidInvoices,
        pendingInvoices,
        overdueInvoices,
        outstandingValue: roundMoney(outstandingRows[0]?.total),
      },
      revenueByMonth,
      recentPayments: payments.map(payment => ({
        id: String(payment._id),
        amount: roundMoney(payment.amount),
        method: payment.method || 'Payment',
        reference: payment.receiptNumber || payment.transactionReference || '',
        status: payment.status,
        createdAt: payment.reviewedAt || payment.createdAt,
        customer: payment.customer?.name || 'Customer',
        invoiceNumber: payment.invoice?.invoiceNumber || 'Invoice unavailable',
      })),
    });
  } catch {
    return res.status(503).json({ message: 'Unable to load the billing dashboard. Please try again.' });
  }
}
