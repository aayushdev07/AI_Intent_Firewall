import type { ToolExecutor } from "./types";
import { deliverEmail, emailMode } from "./mailer";

/**
 * send_email — sends a REAL email only when SMTP is configured in .env (SMTP_HOST etc.)
 * and the address is a real address. Otherwise it is simulated. Either way it runs only
 * after IntentGuard allowed it (or the user approved it once).
 *
 * upload_external — SIMULATED ONLY. It never opens a network connection.
 */
export const sendEmail: ToolExecutor = async (args) => {
  const to = typeof args.to === "string" ? args.to.trim() : "";
  const subject = typeof args.subject === "string" ? args.subject.slice(0, 200) : "(no subject)";
  const body = typeof args.body === "string" ? args.body.slice(0, 5000) : "";
  const attachment = typeof args.attachment === "string" ? args.attachment : null;
  if (emailMode() === "smtp" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) && !/@example\.(com|net|org)$/i.test(to)) {
    try {
      const id = await deliverEmail({ to, subject, text: body || `(Sent by your IntentGuard-protected assistant${attachment ? `; attachment reference: ${attachment}` : ""}.)` });
      return { output: { status: "SENT", to, subject, attachment, messageId: id, note: "Real email sent through your SMTP server." }, meta: { realWorld: true } };
    } catch (err) {
      return { output: { status: "FAILED", to, subject, error: err instanceof Error ? err.message : "SMTP error" }, meta: {} };
    }
  }
  return {
    output: { status: "SIMULATED_SEND", to, subject, attachment, note: "No real email was sent (SMTP not configured, or a demo address)." },
    meta: {},
  };
};

export const uploadExternal: ToolExecutor = (args) => ({
  output: {
    status: "SIMULATED_UPLOAD",
    destination: args.destination,
    filename: args.filename,
    note: "No real upload was performed.",
  },
  meta: {},
});
