import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email/sender";

type NoticeAttachment = { name: string; url: string };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAttachments(value: unknown): NoticeAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      !("name" in item) ||
      !("url" in item) ||
      typeof item.name !== "string" ||
      typeof item.url !== "string"
    ) {
      return [];
    }
    return [{ name: item.name, url: item.url }];
  });
}

export async function sendBatchNoticeEmails(noticeId: string) {
  const notice = await prisma.batchNotice.findUnique({
    where: { id: noticeId },
    include: {
      batch: {
        select: {
          id: true,
          name: true,
          departmentId: true,
          department: { select: { universityId: true } },
        },
      },
      author: { select: { name: true } },
    },
  });
  if (!notice || !notice.sendEmailNotification) return;

  const recipients = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      isRegistered: true,
      universityId: notice.batch.department.universityId,
      studentProfile: {
        is: {
          departmentId: notice.batch.departmentId,
          OR: [
            { enrolledBatchId: notice.batchId },
            { studentBatches: { some: { batchId: notice.batchId, leftAt: null } } },
          ],
        },
      },
    },
    select: { email: true },
  });

  const emails = [...new Set(recipients.map(({ email }) => email))];
  const attachments = getAttachments(notice.attachments);
  const authorName = notice.author.name ?? "Batch CR";
  const portalUrl = getAppUrl("/student/my-batch");
  const safeContent = escapeHtml(notice.content).replace(/\r?\n/g, "<br>");
  const attachmentHtml = attachments.length
    ? `<ul>${attachments
        .map(
          ({ name, url }) =>
            `<li><a href="${escapeHtml(getAppUrl(url))}">${escapeHtml(name)}</a></li>`
        )
        .join("")}</ul>`
    : "";
  const html = [
    `<h1>${escapeHtml(notice.title)}</h1>`,
    `<p><strong>Posted by:</strong> ${escapeHtml(authorName)} (CR, Batch ${escapeHtml(notice.batch.name)})</p>`,
    `<div>${safeContent}</div>`,
    attachmentHtml,
    `<p><a href="${escapeHtml(portalUrl)}">Open the batch noticeboard</a></p>`,
  ].join("\n");
  const text = [
    notice.title,
    `Posted by ${authorName} (CR, Batch ${notice.batch.name})`,
    "",
    notice.content,
    ...(attachments.length
      ? ["", "Attachments:", ...attachments.map(({ name, url }) => `${name}: ${getAppUrl(url)}`)]
      : []),
    "",
    `Open the batch noticeboard: ${portalUrl}`,
  ].join("\n");

  for (let index = 0; index < emails.length; index += 20) {
    const batchRecipients = emails.slice(index, index + 20);
    await Promise.all(
      batchRecipients.map(async (to) => {
        const result = await sendEmail({
          to,
          subject: `[Batch ${notice.batch.name} Announcement] ${notice.title}`,
          html,
          text,
        });

        if (!result.success) {
          console.error(
            `[batch-notice-email] Delivery failed for notice ${notice.id}: ${result.error ?? "unknown provider error"}`
          );
        }
        try {
          await prisma.emailLog.create({
            data: {
              recipient: to,
              relatedNoticeId: notice.id,
              type: "NOTICE",
              status: result.success ? "SENT" : "FAILED",
              error: result.error,
              sentAt: result.success ? new Date() : undefined,
            },
          });
        } catch (error) {
          console.error(
            `[batch-notice-email] Could not record delivery for notice ${notice.id}.`,
            error
          );
        }
      })
    );
  }
}
