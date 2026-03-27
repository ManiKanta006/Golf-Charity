import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });

  return transporter;
}

export async function sendNotificationEmail({ to, subject, text, html }) {
  if (!to) {
    return { skipped: true, reason: "missing-recipient" };
  }

  const sender = process.env.SMTP_FROM || process.env.SMTP_USER;
  const mailer = getTransporter();

  if (!mailer || !sender) {
    console.log(`[email:skip] to=${to} subject=${subject}`);
    return { skipped: true, reason: "smtp-not-configured" };
  }

  await mailer.sendMail({ from: sender, to, subject, text, html });
  return { sent: true };
}

export async function sendBulkNotification(recipients, payloadBuilder) {
  const tasks = recipients
    .filter(Boolean)
    .map((to) => {
      const payload = payloadBuilder(to);
      return sendNotificationEmail({ to, ...payload });
    });

  await Promise.allSettled(tasks);
}
