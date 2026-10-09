export function amountDue(invoice) {
  const value = Number(invoice.amountDue ?? (Number(invoice.totalAmount) - Number(invoice.amountPaid || 0)));
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
export function canPayInvoice(invoice) {
  return ['Pending', 'Partially Paid', 'Overdue'].includes(invoice.paymentStatus) && amountDue(invoice) > 0;
}
