// Provider-agnostic email interface. Business logic (auth routes, future
// mentor-approval routes) calls `sendEmail()` and never imports Resend
// (or any provider) directly — swapping providers later means changing
// this one file, not every call site.

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSendResult {
  success: boolean;
  providerId?: string;
  error?: string;
}

type EmailProvider = "console" | "resend" | "smtp";

async function sendWithResend(input: SendEmailInput): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;

  if (!apiKey || !from) {
    return {
      success: false,
      error: "RESEND_API_KEY and EMAIL_FROM_ADDRESS are required for Resend.",
    };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    return { success: false, error: `Resend API error (${res.status}).` };
  }

  const data = (await res.json()) as { id?: string };
  return { success: true, providerId: data.id };
}

async function sendWithSmtp(input: SendEmailInput): Promise<EmailSendResult> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM_ADDRESS;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from) {
    return {
      success: false,
      error: "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and EMAIL_FROM_ADDRESS are required.",
    };
  }

  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
  });

  try {
    const result = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { success: true, providerId: result.messageId };
  } finally {
    transport.close();
  }
}

/** Console mode is deliberately non-delivering and never prints message contents. */
async function sendWithConsoleLog(): Promise<EmailSendResult> {
  console.info("[DEV] Verification email not delivered because EMAIL_PROVIDER=console.");
  return { success: false, error: "Console email provider does not deliver messages." };
}

export async function sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
  const configuredProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  const provider: EmailProvider = configuredProvider
    ? (configuredProvider as EmailProvider)
    : process.env.RESEND_API_KEY && process.env.EMAIL_FROM_ADDRESS
      ? "resend"
      : "console";

  try {
    switch (provider) {
      case "resend":
        return await sendWithResend(input);
      case "smtp":
        return await sendWithSmtp(input);
      case "console":
        return await sendWithConsoleLog();
      default:
        return { success: false, error: "EMAIL_PROVIDER must be smtp, resend, or console." };
    }
  } catch (error) {
    const errorCode =
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : "unknown";
    const code = /^[A-Z0-9_]+$/i.test(errorCode) ? errorCode : "unknown";
    return { success: false, error: `${provider} email delivery failed (${code}).` };
  }
}
