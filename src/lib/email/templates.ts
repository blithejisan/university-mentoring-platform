import { prisma } from "@/lib/prisma";

// Approval/rejection email templates (and any others introduced later)
// are added to this key list as the features that use them are built.
// Nothing about *how* templates are rendered changes when new keys are
// added, which is the point of storing them in the settings table
// instead of hardcoding subject/body strings into route handlers.
export type EmailTemplateKey =
  | "EMAIL_VERIFICATION"
  | "PASSWORD_RESET"
  | "MENTOR_APPROVED"
  | "MENTOR_REJECTED"
  | "NOTICE"
  | "REMARK"
  | "SESSION_REMINDER";

type TemplateVars = Record<string, string>;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeName(value?: string): string {
  const name = (value ?? "").trim();
  return name.length > 0 ? name : "there";
}

function interpolate(template: string, vars: TemplateVars, htmlMode = false): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!(key in vars) || !vars[key]) {
      if (key === "name") return "there";
      return `{{${key}}}`;
    }

    const rawValue = vars[key] ?? "";
    return htmlMode ? escapeHtml(rawValue) : rawValue;
  });
}

function buildVerificationPlainText(vars: TemplateVars): string {
  const name = normalizeName(vars.name);
  const verificationUrl = vars.verificationUrl || "{{verificationUrl}}";

  return [
    `Hi ${name},`,
    "",
    "Thank you for registering with the Mentor & Student Management Platform.",
    "",
    "Please verify your email address:",
    "",
    verificationUrl,
    "",
    "This verification link will expire in 24 hours.",
    "",
    "If you did not create this account, you can ignore this email.",
    "",
    "Artificial Intelligence and Data Science Department",
    "Green University of Bangladesh",
  ].join("\n");
}

function buildVerificationHtml(vars: TemplateVars): string {
  const name = escapeHtml(normalizeName(vars.name));
  const verificationUrl = escapeHtml(vars.verificationUrl || "{{verificationUrl}}");
  const departmentName = escapeHtml(vars.department || "Artificial Intelligence and Data Science");
  const universityName = escapeHtml(vars.universityName || "Green University of Bangladesh");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f3; margin:0; padding:0; font-family:Arial, Helvetica, sans-serif;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px; width:100%; background-color:#ffffff; border:1px solid #dfe5df; border-radius:10px; overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 10px; text-align:center; background-color:#ffffff;">
                <div style="font-family:Arial, Helvetica, sans-serif; font-size:11px; line-height:18px; letter-spacing:0.08em; text-transform:uppercase; color:#405c4e; font-weight:bold;">
                  Mentor &amp; Student Management Platform
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 32px 20px;">
                <div style="font-family:Georgia, 'Times New Roman', serif; font-size:28px; font-weight:bold; line-height:35px; color:#173f32; text-align:center;">
                  Verify Your Email Address
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px;">
                <div style="font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:25px; color:#26332d;">
                  Hi <strong>${name}</strong>,
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 4px;">
                <div style="font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:25px; color:#46534c;">
                  Thank you for registering with the Mentor &amp; Student Management Platform.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 4px;">
                <div style="font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:25px; color:#46534c;">
                  Please verify your email address to <strong style="color:#263f33;">complete your registration</strong> and continue using the platform.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <div style="font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:23px; color:#59665e;">
                  This verification link will expire in <strong style="color:#344b3e;">24 hours</strong>.
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 32px 10px;">
                <a href="${verificationUrl}" style="display:inline-block; background-color:#174b3a; color:#ffffff; text-decoration:none; border:1px solid #174b3a; border-radius:5px; font-family:Arial, Helvetica, sans-serif; font-size:15px; font-weight:bold; line-height:20px; padding:14px 30px; text-align:center;">
                  Verify Email Address
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:5px 32px 20px; font-family:Arial, Helvetica, sans-serif; font-size:11px; line-height:18px; color:#78827b; text-align:center;">
                If the button above does not work, copy and paste the following link into your browser:<br>
                <a href="${verificationUrl}" style="color:#64766b; font-size:11px; text-decoration:underline; word-break:break-all;">${verificationUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 18px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f0f5f1; border:1px solid #d3e0d6; border-radius:6px;">
                  <tr>
                    <td style="padding:15px 18px; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:20px; color:#43544a; text-align:center;">
                      <strong style="color:#294b38;">For your security,</strong> this verification link will expire in 24 hours.<br>
                      <em style="color:#5f6e64;">If you did not create an account with us, you can safely ignore this email.</em>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 26px; border-top:1px solid #e5e9e4;">
                <div style="font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:19px; text-align:center; color:#66736b;">
                  <div style="font-weight:bold; color:#34473b;">${departmentName}</div>
                  <div style="color:#69766e; padding-top:2px;">${universityName}</div>
                  <div style="padding-top:10px; color:#7a847d;">Account verification email</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function buildMentorDecisionPlainText(vars: TemplateVars, approved: boolean): string {
  const name = normalizeName(vars.name || vars.studentId);
  const studentId = vars.studentId || "Not available";
  const department = vars.department || "Artificial Intelligence and Data Science";
  const decisionDate = vars.decisionDate || "Not available";
  const universityName = vars.universityName || "Green University of Bangladesh";

  if (approved) {
    const loginUrl = vars.loginUrl || "{{loginUrl}}";
    return [
      `Hi ${name},`,
      "",
      `Student ID: ${studentId}`,
      "",
      `Good news! Your mentor application for the ${department} department has been reviewed and approved.`,
      "",
      "Application Status: Approved",
      `Approval Date: ${decisionDate}`,
      "",
      "You can now access the Mentor Dashboard using your registered Student ID and password.",
      "",
      `Access Mentor Dashboard: ${loginUrl}`,
      "",
      "For your security, always access your account through the official platform.",
      "",
      department,
      universityName,
      "Mentor & Student Management Platform",
    ].join("\n");
  }

  const rejectionReason = vars.rejectionReason?.trim() || "No additional reason was provided.";
  return [
    `Hi ${name},`,
    "",
    `Student ID: ${studentId}`,
    "",
    `Thank you for your interest in becoming a mentor in the ${department} department.`,
    "",
    "After reviewing your mentor application, we are unable to approve your application at this time.",
    "",
    "Application Status: Not Approved",
    `Review Date: ${decisionDate}`,
    "",
    "Reason for Application Rejection:",
    rejectionReason,
    "",
    "If you believe this decision was made in error or need further clarification, please contact the department administration.",
    "",
    department,
    universityName,
    "Mentor & Student Management Platform",
  ].join("\n");
}

function buildMentorDecisionHtml(vars: TemplateVars, approved: boolean): string {
  const name = escapeHtml(normalizeName(vars.name || vars.studentId));
  const studentId = escapeHtml(vars.studentId || "Not available");
  const department = escapeHtml(vars.department || "Artificial Intelligence and Data Science");
  const decisionDate = escapeHtml(vars.decisionDate || "Not available");
  const universityName = escapeHtml(vars.universityName || "Green University of Bangladesh");
  const status = approved ? "Approved" : "Not Approved";
  const statusColor = approved ? "#286447" : "#985047";
  const statusBackground = approved ? "#edf5ef" : "#fbefed";
  const title = approved ? "Mentor Application Approved" : "Mentor Application Update";
  const message = approved
    ? `Good news! Your mentor application for the ${department} department has been reviewed and approved.`
    : `Thank you for your interest in becoming a mentor in the ${department} department.<br><br>After reviewing your mentor application, we are unable to approve your application at this time.`;
  const dateLabel = approved ? "Approval Date" : "Review Date";
  const action = approved
    ? `<tr>
              <td style="padding:22px 32px 8px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:26px; color:#3f4744;">
                You can now access the Mentor Dashboard using your registered Student ID and password.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 32px 10px;">
                <a href="${escapeHtml(vars.loginUrl || "{{loginUrl}}")}" style="display:inline-block; background-color:#1f4d3f; color:#ffffff; text-decoration:none; border-radius:6px; font-family:Arial, Helvetica, sans-serif; font-size:16px; font-weight:bold; line-height:18px; padding:16px 28px; min-width:220px; text-align:center;">
                  Access Mentor Dashboard
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 32px 18px; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:20px; color:#616a65; text-align:center;">
                For your security, always access your account through the official platform.
              </td>
            </tr>`
    : `<tr>
              <td style="padding:18px 32px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fbf7f6; border:1px solid #eadbd8; border-radius:8px;">
                  <tr>
                    <td style="padding:16px 18px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:22px; color:#3f4744;">
                      <div style="font-size:12px; line-height:18px; font-weight:bold; color:#754740;">Reason for Application Rejection</div>
                      <div style="padding-top:8px; white-space:pre-line;">${escapeHtml(vars.rejectionReason?.trim() || "No additional reason was provided.")}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 32px 20px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:23px; color:#3f4744;">
                If you believe this decision was made in error or need further clarification, please contact the department administration.
              </td>
            </tr>`;

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f1; margin:0; padding:0; font-family:Arial, Helvetica, sans-serif;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px; width:100%; background-color:#ffffff; border:1px solid #e4e7e1; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 10px; text-align:center; background-color:#ffffff;">
                <div style="font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; letter-spacing:0.14em; text-transform:uppercase; color:#4b5d52; font-weight:bold;">
                  Mentor &amp; Student Management Platform
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 32px 18px;">
                <div style="font-family:Arial, Helvetica, sans-serif; font-size:28px; font-weight:bold; line-height:34px; color:#1e2a27; text-align:center;">
                  ${title}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px;">
                <div style="font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:26px; color:#2a302d;">
                  Hi <strong>${name}</strong>,
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 16px; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:26px; color:#3f4744;">
                ${message}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f7f8f6; border:1px solid #e4e7e1; border-radius:8px;">
                  <tr>
                    <td style="padding:14px 16px; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:20px; color:#69736d;">Student ID</td>
                    <td align="right" style="padding:14px 16px; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:20px; font-weight:bold; color:#2f3634;">${studentId}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 16px; border-top:1px solid #e4e7e1; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:20px; color:#69736d;">Application Status</td>
                    <td align="right" style="padding:12px 16px; border-top:1px solid #e4e7e1; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:18px; font-weight:bold; color:${statusColor};">
                      <span style="display:inline-block; padding:4px 8px; border-radius:4px; background-color:${statusBackground};">${status.toUpperCase()}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 16px; border-top:1px solid #e4e7e1; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:20px; color:#69736d;">${dateLabel}</td>
                    <td align="right" style="padding:12px 16px; border-top:1px solid #e4e7e1; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:20px; color:#2f3634;">${decisionDate}</td>
                  </tr>
                </table>
              </td>
            </tr>
            ${action}
            <tr>
              <td style="padding:18px 32px 28px; border-top:1px solid #e5e8e3;">
                <div style="font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:19px; text-align:center; color:#69736d;">
                  <div style="font-weight:bold; color:#2f3634;">${department}</div>
                  <div style="color:#7a807b; padding-top:2px;">${universityName}</div>
                  <div style="padding-top:12px; color:#7a807b;">Mentor &amp; Student Management Platform</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Resolves an email template by key from the database and interpolates
 * {{variable}} placeholders. Falls back to a built-in default if the
 * settings table row is missing (e.g. before the seed script has run),
 * so auth flows never break because a template row wasn't created yet.
 */
export async function renderEmailTemplate(
  key: EmailTemplateKey,
  vars: TemplateVars,
  universityId?: string
): Promise<{ subject: string; html: string; text: string }> {
  const row = universityId
    ? (await prisma.emailTemplate.findUnique({ where: { key: `${universityId}:${key}` } }))
      ?? (await prisma.emailTemplate.findUnique({ where: { key } }))
    : await prisma.emailTemplate.findUnique({ where: { key } });
  const fallback = DEFAULT_TEMPLATES[key];
  const normalizedVars = {
    ...vars,
    name: normalizeName(
      key === "MENTOR_APPROVED" || key === "MENTOR_REJECTED"
        ? vars.name || vars.studentId
        : vars.name
    ),
    universityName: vars.universityName || "Green University of Bangladesh",
  };

  if (key === "EMAIL_VERIFICATION") {
    const subject = interpolate(fallback.subject, normalizedVars);
    const text = buildVerificationPlainText(normalizedVars);

    return {
      subject,
      html: buildVerificationHtml(normalizedVars),
      text,
    };
  }

  const subject = interpolate(row?.subject ?? fallback.subject, normalizedVars);
  if (key === "MENTOR_APPROVED" || key === "MENTOR_REJECTED") {
    const approved = key === "MENTOR_APPROVED";
    return {
      subject,
      html: buildMentorDecisionHtml(normalizedVars, approved),
      text: buildMentorDecisionPlainText(normalizedVars, approved),
    };
  }

  const body = interpolate(row?.body ?? fallback.body, normalizedVars);
  const html = escapeHtml(body).replace(/\n/g, "<br />");

  return { subject, html: html.replace(/\n/g, "<br />"), text: body };
}

export const DEFAULT_TEMPLATES: Record<EmailTemplateKey, { subject: string; body: string }> = {
  EMAIL_VERIFICATION: {
    subject: "Verify your email address",
    body:
      "Hi {{name}},\n\nThank you for registering with the Mentor & Student Management Platform.\n\nPlease verify your email address to complete your registration and continue using the platform.\n\nThis verification link will expire in 24 hours.\n\n{{verificationUrl}}\n\nIf you did not create this account, you can ignore this email.",
  },
  PASSWORD_RESET: {
    subject: "Reset your {{universityName}} password",
    body:
      "Hi {{name}},\n\nWe received a request to reset your password. This link expires in 30 minutes and can only be used once.\n\n{{resetUrl}}\n\nIf you did not request this, you can ignore this email — your password will not change.",
  },
  MENTOR_APPROVED: {
    subject: "Mentor Application Approved | {{universityName}}",
    body:
      "Mentor Application Approved",
  },
  MENTOR_REJECTED: {
    subject: "Mentor Application Update | {{universityName}}",
    body:
      "Mentor Application Update",
  },
  NOTICE: {
    subject: "New notice: {{title}}",
    body: "Hi {{name}},\n\n{{message}}\n\nOpen the portal: {{url}}",
  },
  REMARK: {
    subject: "Mentor remark: {{remarkType}}",
    body: "Hi {{name}},\n\n{{message}}\n\nOpen the portal: {{url}}",
  },
  SESSION_REMINDER: {
    subject: "Upcoming mentoring session: {{topic}}",
    body: "Hi {{name}},\n\n{{details}}\n\nOpen the portal: {{url}}",
  },
};
