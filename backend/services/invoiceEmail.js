// SMTP helpers for invoice and payment emails. These methods send mail when called; saving a database record alone does not call them.
import nodemailer from 'nodemailer';

const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export const invoiceEmail = {
  isConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM && process.env.FRONTEND_URL);
  },
  async send(invoice, customer) {
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      requireTLS: process.env.NODE_ENV === 'production',
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    const invoiceUrl = new URL('/customer/invoices', process.env.FRONTEND_URL).toString();
    const total = Number(invoice.totalAmount || 0).toFixed(2);
    const due = Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.amountPaid || 0)).toFixed(2);
    await transport.sendMail({
      from: process.env.MAIL_FROM,
      to: customer.email,
      subject: `Invoice ${invoice.invoiceNumber} from AutoServ Pro`,
      text: `Hello ${customer.name || 'Customer'},\n\nInvoice ${invoice.invoiceNumber} is available. Total: LKR ${total}. Amount due: LKR ${due}. View the invoice and payment options here: ${invoiceUrl}`,
      html: `<p>Hello ${escapeHtml(customer.name || 'Customer')},</p><p>Invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> is available.</p><p>Total: <strong>LKR ${total}</strong><br>Amount due: <strong>LKR ${due}</strong></p><p><a href="${escapeHtml(invoiceUrl)}">View invoice and payment options</a></p>`,
    });
  },
  async sendReceipt(payment, invoice, customer) {
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      requireTLS: process.env.NODE_ENV === 'production',
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM,
      to: customer.email,
      subject: `Payment receipt ${payment.receiptNumber} · ${invoice.invoiceNumber}`,
      text: `Hello ${customer.name || 'Customer'},\n\nWe received your payment.\nReceipt: ${payment.receiptNumber}\nInvoice: ${invoice.invoiceNumber}\nAmount: LKR ${Number(payment.amount).toFixed(2)}\nMethod: ${payment.method}\nReference: ${payment.transactionReference}\nStatus: ${payment.status}`,
      html: `<p>Hello ${escapeHtml(customer.name || 'Customer')},</p><p>We received your payment.</p><p>Receipt: <strong>${escapeHtml(payment.receiptNumber)}</strong><br>Invoice: ${escapeHtml(invoice.invoiceNumber)}<br>Amount: <strong>LKR ${Number(payment.amount).toFixed(2)}</strong><br>Method: ${escapeHtml(payment.method)}<br>Reference: ${escapeHtml(payment.transactionReference)}<br>Status: ${escapeHtml(payment.status)}</p>`,
    });
  },
  async sendReminder(invoice, customer, amountDue) {
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      requireTLS: process.env.NODE_ENV === 'production',
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    const invoiceUrl = new URL('/customer/invoices', process.env.FRONTEND_URL).toString();
    const due = Number(amountDue).toFixed(2);
    await transport.sendMail({
      from: process.env.MAIL_FROM, to: customer.email,
      subject: `Payment reminder · Invoice ${invoice.invoiceNumber}`,
      text: `Hello ${customer.name || 'Customer'},\n\nThis is a reminder that invoice ${invoice.invoiceNumber} has an outstanding balance of LKR ${due}. View the invoice and payment options here: ${invoiceUrl}`,
      html: `<p>Hello ${escapeHtml(customer.name || 'Customer')},</p><p>This is a reminder that invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> has an outstanding balance of <strong>LKR ${due}</strong>.</p><p><a href="${escapeHtml(invoiceUrl)}">View invoice and payment options</a></p>`,
    });
  },
};
