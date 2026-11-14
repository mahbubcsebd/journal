import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { otpEmail } from "./email-templates";

let transporter: Transporter | null = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; html: string; text: string }) {
  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP is not configured (SMTP_HOST missing)");
    }
    console.info(`\n[mailer:dev] To: ${opts.to}\nSubject: ${opts.subject}\n${opts.text}\n`);
    return;
  }
  await t.sendMail({ from: process.env.EMAIL_FROM ?? process.env.SMTP_USER, ...opts });
}

export async function sendOtpEmail(email: string, otp: string) {
  const { subject, html, text } = otpEmail(otp);
  await sendMail({ to: email, subject, html, text });
}
