import nodemailer from 'nodemailer';

export const passwordResetEmail = {
  isConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM && process.env.FRONTEND_URL);
  },
  async send(to, token) {
    const url = new URL('/reset-password', process.env.FRONTEND_URL);
    url.searchParams.set('token', token);
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      requireTLS: process.env.NODE_ENV === 'production',
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM, to,
      subject: 'Reset your AutoServ Pro password',
      text: `Reset your password using this link: ${url.toString()}\n\nThe link expires in 30 minutes and can be used once. If you did not request this, ignore this email.`,
    });
  },
};
