import nodemailer from "nodemailer";

/** Optional real email delivery. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in .env. */
export function emailMode(): "smtp" | "simulated" {
  return process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS ? "smtp" : "simulated";
}

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

export async function deliverEmail(msg: { to: string; subject: string; text: string }): Promise<string> {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  const info = await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: msg.to, subject: msg.subject, text: msg.text });
  return String(info.messageId ?? "");
}
