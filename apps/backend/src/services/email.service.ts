import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

export const emailService = {
  async send(to: string, subject: string, html: string) {
    if (!transporter) {
      console.log(`[Email] To: ${to} | Subject: ${subject}`);
      console.log(`[Email] Body: ${html.replace(/<[^>]+>/g, ' ').trim()}`);
      return { sent: false, logged: true };
    }

    await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html,
    });
    return { sent: true };
  },

  async sendPasswordReset(email: string, token: string) {
    const resetUrl = `${config.appUrl}/reset-password?token=${token}`;
    return this.send(
      email,
      'Password Reset - Direct Democracy',
      `<p>You requested a password reset.</p>
       <p><a href="${resetUrl}">Reset your password</a></p>
       <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`
    );
  },

  async sendIssueNotification(email: string, title: string, message: string) {
    return this.send(
      email,
      `Issue Update: ${title}`,
      `<p>${message}</p><p>Log in to Direct Democracy to view details.</p>`
    );
  },
};