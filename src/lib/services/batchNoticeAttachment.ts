import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { AuthError } from "@/lib/auth/guards";
import { requireApprovedMentor } from "@/lib/auth/guards";
import type { AccessTokenPayload } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILES = {
  ".pdf": { type: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  ".docx": {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    signature: [0x50, 0x4b, 0x03, 0x04],
  },
  ".png": { type: "image/png", signature: [0x89, 0x50, 0x4e, 0x47] },
  ".jpg": { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  ".jpeg": { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
} as const;

export class BatchNoticeAttachmentStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BatchNoticeAttachmentStorageError";
  }
}

export async function uploadBatchNoticeAttachment(
  actor: AccessTokenPayload,
  file: File
) {
  if (actor.role !== "STUDENT" && actor.role !== "MENTOR") {
    throw new AuthError("Only an approved CR can upload batch notice attachments.", 403);
  }
  if (actor.role === "MENTOR") await requireApprovedMentor(actor);
  if (!file.size || file.size > MAX_FILE_SIZE) {
    throw new AuthError("Attachments must be 10 MB or smaller.", 400);
  }

  const extension = path.extname(file.name).toLowerCase() as keyof typeof ALLOWED_FILES;
  const fileType = ALLOWED_FILES[extension];
  if (!fileType) {
    throw new AuthError("Upload a PDF, DOCX, PNG, or JPG file.", 400);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!fileType.signature.every((byte, index) => bytes[index] === byte)) {
    throw new AuthError("The uploaded file does not match its file type.", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.sub },
    select: {
      isCR: true,
      crStatus: true,
      crBatchId: true,
      status: true,
      role: true,
      studentProfile: {
        select: {
          enrolledBatchId: true,
          studentBatches: {
            where: { leftAt: null },
            select: { batchId: true },
          },
        },
      },
    },
  });
  if (
    !user ||
    user.role !== actor.role ||
    user.status !== "ACTIVE" ||
    !user.isCR ||
    user.crStatus !== "APPROVED" ||
    !user.crBatchId ||
    !user.studentProfile?.studentBatches.some(
      ({ batchId }) => batchId === user.crBatchId
    )
  ) {
    throw new AuthError("Only an approved CR in an active batch can upload attachments.", 403);
  }

  const storedName = `${randomUUID()}${extension}`;
  let url: string;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    try {
      const blob = await put(`batch-notices/${storedName}`, bytes, {
        access: "public",
        addRandomSuffix: false,
        contentType: fileType.type,
        token: blobToken,
      });
      url = blob.url;
    } catch (error) {
      throw new BatchNoticeAttachmentStorageError(
        "File storage could not save the upload. Check BLOB_READ_WRITE_TOKEN and storage availability.",
        { cause: error }
      );
    }
  } else if (process.env.NODE_ENV !== "production") {
    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "batch-notices"
    );
    try {
      await mkdir(uploadDirectory, { recursive: true });
      await writeFile(path.join(uploadDirectory, storedName), bytes, { flag: "wx" });
    } catch (error) {
      throw new BatchNoticeAttachmentStorageError(
        "The uploaded file could not be saved to local storage.",
        { cause: error }
      );
    }
    url = `/uploads/batch-notices/${storedName}`;
  } else {
    throw new BatchNoticeAttachmentStorageError(
      "File uploads are not configured. Set BLOB_READ_WRITE_TOKEN for production storage."
    );
  }

  return {
    name: file.name,
    url,
    type: fileType.type,
    size: file.size,
  };
}
