import nodemailer from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string;
  bcc?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

/**
 * Checks whether an SMTP or Resend email transport is configured in the environment.
 */
export function isEmailConfigured(): boolean {
  return (
    Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
    Boolean(process.env.RESEND_API_KEY)
  );
}

/**
 * Returns configuration info for display in the coordinator interface (without leaking secrets).
 */
export function getEmailConfigInfo() {
  const host = process.env.SMTP_HOST || "";
  const user = process.env.SMTP_USER || "";

  if (host) {
    const isGmail = host.includes("gmail.com") || user.includes("@gmail.com");
    return {
      configured: true,
      provider: isGmail ? `Gmail SMTP (${user})` : `SMTP (${host})`,
      from: process.env.SMTP_FROM || user || "placement@srmist.edu.in",
    };
  }
  if (process.env.RESEND_API_KEY) {
    return {
      configured: true,
      provider: "Resend Email Service",
      from: process.env.SMTP_FROM || "onboarding@resend.dev",
    };
  }
  return {
    configured: false,
    provider: "Simulated / Logged Mode",
    from: "placement@srmist.edu.in",
  };
}

/**
 * Create or reuse nodemailer transport based on environment variables.
 */
function createTransport() {
  if (process.env.RESEND_API_KEY && !process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: {
        user: "resend",
        pass: process.env.RESEND_API_KEY,
      },
    });
  }

  const host = process.env.SMTP_HOST || "";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";

  if (host && user && pass) {
    const isGmail = host.includes("gmail.com") || user.includes("@gmail.com");
    if (isGmail) {
      return nodemailer.createTransport({
        service: "gmail",
        auth: {
          user,
          pass,
        },
      });
    }

    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  return null;
}

/**
 * Send a single email with HTML and text formats.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const transport = createTransport();
  const from =
    process.env.SMTP_FROM ||
    (process.env.SMTP_USER
      ? `"SRM Placement Cell" <${process.env.SMTP_USER}>`
      : '"SRM Placement Cell" <placement@srmist.edu.in>');

  if (!transport) {
    // Simulated delivery for local dev / demo when SMTP credentials are not yet added
    console.log(`[EMAIL SIMULATED] To: ${opts.to} | Subject: ${opts.subject}`);
    return {
      success: true,
      simulated: true,
      messageId: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  try {
    const info = await transport.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html || opts.text.replace(/\n/g, "<br>"),
      cc: opts.cc,
      bcc: opts.bcc,
    });

    return {
      success: true,
      messageId: info.messageId,
      simulated: false,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "SMTP delivery failed";
    console.error(`[EMAIL ERROR] Failed to send email to ${opts.to}:`, message);
    return {
      success: false,
      error: message,
      simulated: false,
    };
  }
}

/**
 * Generate a clean, responsive HTML email matching SRM branding.
 */
export function buildPlacementReminderHtml(params: {
  studentName: string;
  registerNumber: string;
  missingDocumentsText: string;
  customMessage: string;
  portalUrl?: string;
}) {
  const portalUrl = params.portalUrl || "https://placement-metrics.vercel.app/my-submission";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SRM Placement Document Reminder</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f5f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c2024; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f6f5f2; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2ded5; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #165b33; padding: 20px 24px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; text-transform: uppercase; tracking: 1px; color: #a3e6b9; font-weight: 700; letter-spacing: 0.5px;">SRM Institute of Science and Technology</div>
                    <div style="font-size: 18px; font-weight: 800; color: #ffffff; margin-top: 2px;">School of Computing — Placement Cell</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alert Badge -->
          <tr>
            <td style="padding: 24px 24px 12px 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 4px 12px; font-size: 12px; font-weight: 700; color: #92400e;">
                    ⚠️ ACTION REQUIRED: Verification Documents Pending
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting & Details -->
          <tr>
            <td style="padding: 0 24px 16px 24px; font-size: 14px; line-height: 1.6; color: #1c2024;">
              <p style="margin: 0 0 12px 0;">Dear <strong>${params.studentName}</strong> (Reg No: <span style="font-family: monospace; font-weight: 600;">${params.registerNumber}</span>),</p>
              <p style="margin: 0 0 16px 0; color: #374151;">
                ${params.customMessage.replace(/\n/g, "<br>")}
              </p>

              <!-- Missing Documents Card -->
              <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #991b1b; margin-bottom: 6px;">
                  Pending / Missing Submission(s):
                </div>
                <div style="font-size: 14px; font-weight: 700; color: #7f1d1d; line-height: 1.5;">
                  ${params.missingDocumentsText}
                </div>
              </div>

              <p style="margin: 16px 0; color: #4b5563; font-size: 13px;">
                Please upload these verification documents immediately on the placement portal to ensure your eligibility for upcoming campus placement drives and company shortlists.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 24px 0 12px 0;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #165b33;">
                    <a href="${portalUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 13px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 6px;">
                      Log In &amp; Upload Documents &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 11px; color: #6b7280; margin-top: 12px;">
                Direct link: <a href="${portalUrl}" style="color: #165b33;">${portalUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #faf8f5; border-top: 1px solid #e2ded5; padding: 16px 24px; font-size: 11px; color: #6b7280; text-align: left; line-height: 1.5;">
              <strong>Placement &amp; Training Coordination Cell</strong><br>
              Department of Computer Science and Engineering<br>
              SRM Institute of Science and Technology, Kattankulathur — 603203<br>
              <em>This is an automated notification dispatched by authorized placement evaluators.</em>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
